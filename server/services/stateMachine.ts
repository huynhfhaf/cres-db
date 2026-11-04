import crypto from 'crypto';
import { db, getSystemNowIso, getSetting } from '../db/database';
import type { Application, ApplicationStatus, EndReason, RecruitmentRound } from '../../src/types';
import { END_STATUSES } from '../../src/types';
import {
  isValidStateTransition,
  checkRequiredFields,
  evaluateScreeningProfile,
  screenByThreshold,
  isNearThreshold,
  REQUIRED_FIELD_LABELS,
  canConvergeInterviewAndJoin,
  computeTotalScore,
} from '../rules/rulesEngine';
import { NotificationService } from './notificationService';

export interface TransitionOptions {
  applicationId: string;
  nextStatus: ApplicationStatus;
  actor: string; // 'system' | 'user:<id>'
  action: string;
  ruleApplied: string;
  inputSnapshot: Record<string, unknown>;
  resultText: string;
  endReason?: EndReason | null;
  extraColumns?: Record<string, unknown>;
  timestampIso?: string;
}

/**
 * Central state machine transition function.
 * All application status updates MUST pass through this function.
 */
export function transition(opts: TransitionOptions): Application {
  const app = db
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(opts.applicationId) as Application | undefined;

  if (!app) {
    throw new Error(`Không tìm thấy hồ sơ ${opts.applicationId}`);
  }

  if (!isValidStateTransition(app.status, opts.nextStatus)) {
    throw new Error(
      `Chuyển trạng thái không hợp lệ: từ "${app.status}" sang "${opts.nextStatus}"`
    );
  }

  const nowIso = opts.timestampIso || getSystemNowIso();
  const isEnd = END_STATUSES.includes(opts.nextStatus);

  const updates: Record<string, unknown> = {
    status: opts.nextStatus,
    updated_at: nowIso,
    ...(opts.extraColumns || {}),
  };

  if (opts.endReason !== undefined) {
    updates.end_reason = opts.endReason;
  } else if (isEnd) {
    updates.end_reason = opts.nextStatus as EndReason;
  }

  if (isEnd && !updates.finished_at) {
    updates.finished_at = nowIso;
  }

  const setClauses = Object.keys(updates)
    .map((col) => `${col} = @${col}`)
    .join(', ');

  const auditId = crypto.randomUUID();

  const runTx = db.transaction(() => {
    db.prepare(`UPDATE applications SET ${setClauses} WHERE id = @id`).run({
      ...updates,
      id: opts.applicationId,
    });

    db.prepare(`
      INSERT INTO audit_logs (id, application_id, actor, action, rule_applied, input_snapshot, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditId,
      opts.applicationId,
      opts.actor,
      opts.action,
      opts.ruleApplied,
      JSON.stringify({
        previousStatus: app.status,
        nextStatus: opts.nextStatus,
        ...opts.inputSnapshot,
      }),
      opts.resultText,
      nowIso
    );
  });

  runTx();

  return db
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(opts.applicationId) as Application;
}

export function writeAuditLog(params: {
  applicationId: string | null;
  actor: string;
  action: string;
  ruleApplied: string;
  inputSnapshot: Record<string, unknown>;
  result: string;
  createdAt?: string;
}) {
  const nowIso = params.createdAt || getSystemNowIso();
  db.prepare(`
    INSERT INTO audit_logs (id, application_id, actor, action, rule_applied, input_snapshot, result, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    params.applicationId,
    params.actor,
    params.action,
    params.ruleApplied,
    JSON.stringify(params.inputSnapshot),
    params.result,
    nowIso
  );
}

/**
 * Executes Step 2 -> Step 3 -> Step 4 -> Step 7 automated rule pipeline for a newly submitted or supplemented application.
 */
export function runAutomatedCheckAndScreenPipeline(applicationId: string, actor: string = 'system'): Application {
  let app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Application;
  const round = db.prepare('SELECT * FROM recruitment_rounds WHERE id = ?').get(app.round_id) as RecruitmentRound;
  const now = new Date(getSystemNowIso());
  const nowIso = now.toISOString();

  // Move to 'checking'
  app = transition({
    applicationId: app.id,
    nextStatus: 'checking',
    actor,
    action: 'CHECK_REQUIRED_FIELDS_START',
    ruleApplied: 'checkRequiredFields(application)',
    inputSnapshot: { supplement_count: app.supplement_count },
    resultText: 'Bắt đầu kiểm tra tự động các trường thông tin bắt buộc trên Sheet.',
    timestampIso: nowIso,
  });

  const checkRes = checkRequiredFields(app);

  // Clear previous missing fields for current round or re-record
  db.prepare('DELETE FROM application_missing_fields WHERE application_id = ?').run(app.id);

  if (!checkRes.isComplete) {
    // Check if supplement_count >= round.supplement_max_rounds (default 2)
    if (app.supplement_count >= round.supplement_max_rounds) {
      app = transition({
        applicationId: app.id,
        nextStatus: 'expired_supplement',
        actor: 'system',
        action: 'AUTO_REJECT_MAX_SUPPLEMENT_EXCEEDED',
        ruleApplied: `supplement_count (${app.supplement_count}) >= max_rounds (${round.supplement_max_rounds})`,
        inputSnapshot: {
          missingFields: checkRes.missingFields,
          supplementCount: app.supplement_count,
          maxRounds: round.supplement_max_rounds,
        },
        resultText: `Loại tự động vì sau ${app.supplement_count} lần bổ sung vẫn thiếu: ${checkRes.missingFields.map((f) => REQUIRED_FIELD_LABELS[f] || f).join(', ')}`,
        endReason: 'expired_supplement',
        extraColumns: {
          supplement_deadline_at: null,
        },
        timestampIso: nowIso,
      });

      NotificationService.send({
        applicationId: app.id,
        toEmail: app.email || 'candidate@due.udn.vn',
        templateKey: 'expired_supplement',
        variables: {
          full_name: app.full_name || 'Ứng viên',
          deadline: now.toLocaleString('vi-VN'),
          link: '/my-application',
        },
        createdAt: nowIso,
      });

      return app;
    }

    // Request supplement with 2-day timer
    const nextRoundNo = app.supplement_count + 1;
    for (const field of checkRes.missingFields) {
      db.prepare(`
        INSERT INTO application_missing_fields (id, application_id, field_name, round_no, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), app.id, field, nextRoundNo, nowIso, nowIso);
    }

    const deadlineDate = new Date(now.getTime() + round.supplement_deadline_days * 24 * 60 * 60 * 1000);
    const deadlineIso = deadlineDate.toISOString();
    const missingText = checkRes.missingFields.map((f) => REQUIRED_FIELD_LABELS[f] || f).join(', ');

    app = transition({
      applicationId: app.id,
      nextStatus: 'needs_supplement',
      actor: 'system',
      action: 'REQUEST_SUPPLEMENT',
      ruleApplied: `missingFields.length > 0 && supplement_count (${app.supplement_count}) < ${round.supplement_max_rounds}`,
      inputSnapshot: {
        missingFields: checkRes.missingFields,
        supplementDeadlineDays: round.supplement_deadline_days,
        deadlineAt: deadlineIso,
      },
      resultText: `Yêu cầu bổ sung hồ sơ (Lần ${nextRoundNo}/${round.supplement_max_rounds}). Thiếu: ${missingText}`,
      extraColumns: {
        supplement_deadline_at: deadlineIso,
      },
      timestampIso: nowIso,
    });

    NotificationService.send({
      applicationId: app.id,
      toEmail: app.email || 'candidate@due.udn.vn',
      templateKey: 'supplement_request',
      variables: {
        full_name: app.full_name || 'Ứng viên',
        missing_fields: missingText,
        deadline: deadlineDate.toLocaleString('vi-VN'),
        link: `/my-application`,
      },
      createdAt: nowIso,
    });

    return app;
  }

  // All required fields present -> Step 4: Automated Screening
  app = transition({
    applicationId: app.id,
    nextStatus: 'screening',
    actor: 'system',
    action: 'START_AUTO_SCREENING',
    ruleApplied: 'checkRequiredFields.isComplete === true',
    inputSnapshot: { full_name: app.full_name, student_id: app.student_id },
    resultText: 'Hồ sơ đủ thông tin bắt buộc. Chuyển sang sơ loại tự động theo tiêu chí chấm điểm.',
    extraColumns: {
      supplement_deadline_at: null,
    },
    timestampIso: nowIso,
  });

  const hardConfigRaw = getSetting('hard_conditions', '');
  let hardConfig = {
    requireValidEmail: true,
    requireActiveStudentId: true,
    requireValidPhone: true,
    requireTimeCommitment: true,
  };
  if (hardConfigRaw) {
    try {
      hardConfig = { ...hardConfig, ...JSON.parse(hardConfigRaw) };
    } catch {
      // ignore
    }
  }

  const evalRes = evaluateScreeningProfile(app, hardConfig);
  const branch = screenByThreshold(
    evalRes.score,
    evalRes.hardConditionsPassed,
    round.threshold_x,
    round.threshold_y
  );
  const nearThreshold =
    branch === 'clear_fail' &&
    isNearThreshold(
      evalRes.score,
      evalRes.hardConditionsPassed,
      round.threshold_y,
      round.near_threshold_margin
    );

  app = transition({
    applicationId: app.id,
    nextStatus: branch,
    actor: 'system',
    action: 'AUTO_SCREENING_RESULT',
    ruleApplied: `screenByThreshold(score=${evalRes.score}, hardPassed=${evalRes.hardConditionsPassed}, X=${round.threshold_x}, Y=${round.threshold_y}, margin=${round.near_threshold_margin})`,
    inputSnapshot: {
      score: evalRes.score,
      breakdown: evalRes.scoreBreakdown,
      hardConditionsPassed: evalRes.hardConditionsPassed,
      violatedConditions: evalRes.violatedConditions,
      thresholdX: round.threshold_x,
      thresholdY: round.threshold_y,
      nearThreshold,
    },
    resultText:
      branch === 'clear_pass'
        ? `Đạt rõ (${evalRes.score} điểm >= X=${round.threshold_x}, đủ điều kiện cứng).`
        : branch === 'needs_review'
        ? `Cần xem xét (${round.threshold_y} <= ${evalRes.score} điểm < ${round.threshold_x}). Chờ HR duyệt tự luận.`
        : nearThreshold
        ? `Loại rõ gần ngưỡng (${evalRes.score} điểm, cách Y=${round.threshold_y} trong biên độ ${round.near_threshold_margin} điểm). Đưa vào danh sách HR xem lại trước khi gửi.`
        : `Loại rõ (${evalRes.score} điểm < Y=${round.threshold_y}${
            evalRes.violatedConditions.length ? `, vi phạm: ${evalRes.violatedConditions.join('; ')}` : ''
          }).`,
    extraColumns: {
      screening_score: evalRes.score,
      screening_result: branch,
      is_near_threshold: nearThreshold ? 1 : 0,
    },
    timestampIso: nowIso,
  });

  if (branch === 'clear_pass') {
    // Automatically send interview booking link (Step 7)
    return sendInterviewBookingInvitation(app.id, 'system', nowIso);
  }

  if (branch === 'clear_fail' && !nearThreshold) {
    // Clear fail NOT near threshold -> immediately reject & notify
    const reasonText =
      evalRes.violatedConditions.length > 0
        ? `Vi phạm điều kiện cứng: ${evalRes.violatedConditions.join(', ')}`
        : `Điểm sơ loại (${evalRes.score}đ) thấp hơn ngưỡng tối thiểu Y (${round.threshold_y}đ)`;

    app = transition({
      applicationId: app.id,
      nextStatus: 'rejected_docs',
      actor: 'system',
      action: 'AUTO_REJECT_CLEAR_FAIL',
      ruleApplied: `score (${evalRes.score}) < Y - margin (${round.threshold_y - round.near_threshold_margin}) || !hardConditionsPassed`,
      inputSnapshot: {
        score: evalRes.score,
        violatedConditions: evalRes.violatedConditions,
      },
      resultText: `Tự động gửi thông báo không đạt vòng hồ sơ (${reasonText}).`,
      endReason: 'rejected_docs',
      timestampIso: nowIso,
    });

    NotificationService.send({
      applicationId: app.id,
      toEmail: app.email,
      templateKey: 'docs_rejected',
      variables: {
        full_name: app.full_name,
        reason: reasonText,
      },
      createdAt: nowIso,
    });
  }

  return app;
}

/**
 * Step 7: Sends interview booking link and starts 1-day reminder / 2-day unbook timers.
 */
export function sendInterviewBookingInvitation(
  applicationId: string,
  actor: string = 'system',
  timestampIso?: string
): Application {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Application;
  const round = db.prepare('SELECT * FROM recruitment_rounds WHERE id = ?').get(app.round_id) as RecruitmentRound;
  const nowIso = timestampIso || getSystemNowIso();
  const nowMs = new Date(nowIso).getTime();

  const deadlineDate = new Date(nowMs + round.unbook_after_days * 24 * 60 * 60 * 1000);
  const deadlineIso = deadlineDate.toISOString();

  const updated = transition({
    applicationId: app.id,
    nextStatus: 'invited_to_book',
    actor,
    action: 'SEND_INTERVIEW_BOOKING_LINK',
    ruleApplied: `Invite candidate passed docs screening; unbook_after_days=${round.unbook_after_days}, remind_after_days=${round.remind_after_days}`,
    inputSnapshot: {
      scheduleLinkSentAt: nowIso,
      scheduleDeadlineAt: deadlineIso,
    },
    resultText: `Đã gửi link đặt lịch phỏng vấn. Hạn đặt lịch: ${deadlineDate.toLocaleString('vi-VN')}.`,
    extraColumns: {
      schedule_link_sent_at: nowIso,
      schedule_reminded_at: null,
      schedule_deadline_at: deadlineIso,
    },
    timestampIso: nowIso,
  });

  NotificationService.send({
    applicationId: app.id,
    toEmail: app.email,
    templateKey: 'schedule_link',
    variables: {
      full_name: app.full_name,
      link: '/my-application',
      deadline: deadlineDate.toLocaleString('vi-VN'),
    },
    createdAt: nowIso,
  });

  return updated;
}

/**
 * Checks AND-join condition after check-in or scorecard submission:
 * Converges when candidate has checked in AND submitted scorecards >= round.min_scorecards_per_interview.
 */
export function evaluateInterviewAndJoin(applicationId: string, actor: string): Application {
  let app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Application;
  const round = db.prepare('SELECT * FROM recruitment_rounds WHERE id = ?').get(app.round_id) as RecruitmentRound;
  const booking = db
    .prepare('SELECT * FROM interview_bookings WHERE application_id = ?')
    .get(applicationId) as { checked_in_at: string | null } | undefined;

  const scorecardsRows = db
    .prepare('SELECT * FROM scorecards WHERE application_id = ?')
    .all(applicationId) as Array<{ scores: string }>;

  const scorecardCount = scorecardsRows.length;
  const checkedInAt = booking?.checked_in_at || null;
  const nowIso = getSystemNowIso();

  if (app.status === 'booked' && (checkedInAt || scorecardCount > 0)) {
    app = transition({
      applicationId: app.id,
      nextStatus: 'interviewing',
      actor,
      action: 'PARALLEL_INTERVIEW_IN_PROGRESS',
      ruleApplied: 'AND-split: Candidate Check-in || Board Scorecard Started',
      inputSnapshot: { checkedInAt, scorecardCount },
      resultText: `Đang thực hiện nhánh song song: ${checkedInAt ? 'Đã check-in' : 'Chưa check-in'}, có ${scorecardCount}/${round.min_scorecards_per_interview} phiếu điểm.`,
      timestampIso: nowIso,
    });
  }

  if (
    (app.status === 'booked' || app.status === 'interviewing') &&
    canConvergeInterviewAndJoin(checkedInAt, scorecardCount, round.min_scorecards_per_interview)
  ) {
    const criteria = db
      .prepare('SELECT id, weight, max_score FROM scoring_criteria WHERE round_id = ?')
      .all(app.round_id) as Array<{ id: string; weight: number; max_score: number }>;

    const parsedCards = scorecardsRows.map((r) => ({
      scores: JSON.parse(r.scores || '{}'),
    }));
    const weightedTotal = computeTotalScore(parsedCards, criteria);

    app = transition({
      applicationId: app.id,
      nextStatus: 'scored',
      actor: 'system',
      action: 'AND_JOIN_INTERVIEW_CONVERGED',
      ruleApplied: `canConvergeInterviewAndJoin(checkedIn=${Boolean(checkedInAt)}, scorecards=${scorecardCount} >= min=${round.min_scorecards_per_interview})`,
      inputSnapshot: {
        checkedInAt,
        scorecardCount,
        minRequired: round.min_scorecards_per_interview,
        computedWeightedScore: weightedTotal,
      },
      resultText: `Hội tụ AND-join hoàn tất: Ứng viên đã check-in và đủ ${scorecardCount} phiếu chấm. Điểm tổng hợp có trọng số: ${weightedTotal}đ. Chuyển ngay sang BCN xét chọn.`,
      timestampIso: nowIso,
    });
  }

  return app;
}

/**
 * Global exception handler: Candidate withdraws application at any step before completion.
 * - Marks status = 'withdrawn', end_reason = 'withdrawn'
 * - Cancels all running timers (supplement_deadline_at, schedule_deadline_at)
 * - If already assigned to a department -> automatically revokes assignment and restores quota!
 */
export function withdrawApplication(
  applicationId: string,
  reason: string,
  actor: string
): Application {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Application | undefined;
  if (!app) {
    throw new Error('Không tìm thấy hồ sơ ứng tuyển.');
  }
  if (END_STATUSES.includes(app.status)) {
    throw new Error('Hồ sơ đã ở trạng thái kết thúc, không thể rút đơn.');
  }

  const nowIso = getSystemNowIso();

  // Check if candidate had an assignment
  const existingAssignment = db
    .prepare('SELECT * FROM assignments WHERE application_id = ? AND status != ?')
    .get(applicationId, 'revoked') as { id: string; department_id: string; status: string } | undefined;

  let revokedDeptName: string | null = null;
  if (existingAssignment) {
    const dept = db
      .prepare('SELECT name FROM departments WHERE id = ?')
      .get(existingAssignment.department_id) as { name: string } | undefined;
    revokedDeptName = dept?.name || existingAssignment.department_id;

    db.prepare(`
      UPDATE assignments
      SET status = 'revoked', updated_at = ?
      WHERE id = ?
    `).run(nowIso, existingAssignment.id);

    writeAuditLog({
      applicationId,
      actor: 'system',
      action: 'COMPENSATE_REVOKE_ASSIGNMENT',
      ruleApplied: 'Withdraw Exception -> If assigned then revoke assignment & return department quota',
      inputSnapshot: {
        assignmentId: existingAssignment.id,
        departmentId: existingAssignment.department_id,
        previousAssignmentStatus: existingAssignment.status,
      },
      result: `Đã hoàn tác phân công tại ${revokedDeptName} và hoàn trả 1 chỉ tiêu cho ban.`,
      createdAt: nowIso,
    });
  }

  // Delete active interview booking if any so slot capacity is freed
  const existingBooking = db
    .prepare('SELECT * FROM interview_bookings WHERE application_id = ?')
    .get(applicationId) as { id: string; slot_id: string } | undefined;
  if (existingBooking) {
    db.prepare('DELETE FROM interview_bookings WHERE id = ?').run(existingBooking.id);
  }

  const updated = transition({
    applicationId,
    nextStatus: 'withdrawn',
    actor,
    action: 'CANDIDATE_WITHDRAW',
    ruleApplied: 'Global Withdraw Exception (Terminate Case & Cancel Active Timers)',
    inputSnapshot: {
      withdrawReason: reason,
      previousStatus: app.status,
      revokedAssignmentDept: revokedDeptName,
      cancelledTimers: {
        supplement_deadline_at: app.supplement_deadline_at,
        schedule_deadline_at: app.schedule_deadline_at,
      },
    },
    resultText: `Ứng viên rút đơn (Lý do: ${reason}). Đã hủy toàn bộ timer${
      revokedDeptName ? ` và hoàn tác phân công ban ${revokedDeptName}` : ''
    }.`,
    endReason: 'withdrawn',
    extraColumns: {
      withdraw_reason: reason,
      supplement_deadline_at: null,
      schedule_deadline_at: null,
    },
    timestampIso: nowIso,
  });

  NotificationService.send({
    applicationId: app.id,
    toEmail: app.email,
    templateKey: 'withdrawn_ack',
    variables: {
      full_name: app.full_name,
      deadline: new Date(nowIso).toLocaleString('vi-VN'),
    },
    createdAt: nowIso,
  });

  return updated;
}
