import { db, getSystemNow, getSetting, setSetting } from '../db/database';
import type { Application, RecruitmentRound } from '../../src/types';
import { isSupplementExpired, shouldRemind, shouldDrop } from '../rules/rulesEngine';
import { transition, writeAuditLog } from '../services/stateMachine';
import { NotificationService } from '../services/notificationService';

export interface SchedulerScanSummary {
  scannedAt: string;
  expiredSupplementsCount: number;
  remindedBookingCount: number;
  droppedNoBookingCount: number;
  affectedApplicationIds: string[];
}

/**
 * Scans all active timers in the database against the current virtual clock (getSystemNow()).
 * Also advances virtual_offset_ms proportionally if TIME_SCALE > 1.
 */
export function runTimerTick(advanceScaleTick: boolean = false): SchedulerScanSummary {
  if (advanceScaleTick) {
    const timeScale = Number(getSetting('TIME_SCALE', process.env.TIME_SCALE || '1')) || 1;
    if (timeScale > 1) {
      // Every real 10s tick adds (timeScale - 1) * 10s to virtual_offset_ms
      const currentOffset = Number(getSetting('virtual_offset_ms', '0')) || 0;
      const deltaMs = (timeScale - 1) * 10000;
      setSetting('virtual_offset_ms', String(currentOffset + deltaMs));
    }
  }

  const now = getSystemNow();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  let expiredSupplementsCount = 0;
  let remindedBookingCount = 0;
  let droppedNoBookingCount = 0;
  const affectedApplicationIds: string[] = [];

  // 1. Check 'needs_supplement' applications that exceeded 2-day deadline
  const supplementApps = db
    .prepare("SELECT * FROM applications WHERE status = 'needs_supplement'")
    .all() as Application[];

  for (const app of supplementApps) {
    if (isSupplementExpired(app, nowMs)) {
      const round = db
        .prepare('SELECT * FROM recruitment_rounds WHERE id = ?')
        .get(app.round_id) as RecruitmentRound | undefined;

      transition({
        applicationId: app.id,
        nextStatus: 'expired_supplement',
        actor: 'system',
        action: 'TIMER_EXPIRED_SUPPLEMENT',
        ruleApplied: `isSupplementExpired(deadline=${app.supplement_deadline_at}, now=${nowIso}, maxDays=${round?.supplement_deadline_days ?? 2})`,
        inputSnapshot: {
          supplementDeadlineAt: app.supplement_deadline_at,
          evaluatedAt: nowIso,
          supplementCount: app.supplement_count,
        },
        resultText: `Quá hạn bổ sung hồ sơ 2 ngày (Hạn: ${
          app.supplement_deadline_at ? new Date(app.supplement_deadline_at).toLocaleString('vi-VN') : ''
        }). Tự động chuyển kết thúc "Bị loại vì quá hạn".`,
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
          deadline: app.supplement_deadline_at
            ? new Date(app.supplement_deadline_at).toLocaleString('vi-VN')
            : now.toLocaleString('vi-VN'),
          link: '/my-application',
        },
        createdAt: nowIso,
      });

      expiredSupplementsCount += 1;
      affectedApplicationIds.push(app.id);
    }
  }

  // 2. Check 'invited_to_book' applications for 2-day drop or 1-day reminder
  const invitedApps = db
    .prepare("SELECT * FROM applications WHERE status = 'invited_to_book'")
    .all() as Application[];

  for (const app of invitedApps) {
    const round = db
      .prepare('SELECT * FROM recruitment_rounds WHERE id = ?')
      .get(app.round_id) as RecruitmentRound | undefined;
    const remindDays = round?.remind_after_days ?? 1;
    const unbookDays = round?.unbook_after_days ?? 2;

    // First check if 2-day deadline has passed -> drop immediately
    if (shouldDrop(app, nowMs)) {
      transition({
        applicationId: app.id,
        nextStatus: 'no_booking',
        actor: 'system',
        action: 'TIMER_DROP_NO_BOOKING',
        ruleApplied: `shouldDrop(schedule_deadline_at=${app.schedule_deadline_at} <= now=${nowIso}, unbookAfterDays=${unbookDays})`,
        inputSnapshot: {
          scheduleLinkSentAt: app.schedule_link_sent_at,
          scheduleRemindedAt: app.schedule_reminded_at,
          scheduleDeadlineAt: app.schedule_deadline_at,
          evaluatedAt: nowIso,
        },
        resultText: `Quá hạn ${unbookDays} ngày không chọn lịch phỏng vấn. Tự động gạch tên khỏi danh sách ("Ứng viên không tham gia").`,
        endReason: 'no_booking',
        extraColumns: {
          schedule_deadline_at: null,
        },
        timestampIso: nowIso,
      });

      NotificationService.send({
        applicationId: app.id,
        toEmail: app.email,
        templateKey: 'removed_no_booking',
        variables: {
          full_name: app.full_name,
          deadline: app.schedule_deadline_at
            ? new Date(app.schedule_deadline_at).toLocaleString('vi-VN')
            : now.toLocaleString('vi-VN'),
        },
        createdAt: nowIso,
      });

      droppedNoBookingCount += 1;
      affectedApplicationIds.push(app.id);
      continue;
    }

    // Next check if 1-day reminder should be sent (only once!)
    if (shouldRemind(app, remindDays, nowMs)) {
      db.prepare(`
        UPDATE applications
        SET schedule_reminded_at = ?, updated_at = ?
        WHERE id = ? AND schedule_reminded_at IS NULL
      `).run(nowIso, nowIso, app.id);

      writeAuditLog({
        applicationId: app.id,
        actor: 'system',
        action: 'TIMER_REMIND_BOOKING',
        ruleApplied: `shouldRemind(sentAt=${app.schedule_link_sent_at}, remindAfterDays=${remindDays}, remindedAt=null)`,
        inputSnapshot: {
          scheduleLinkSentAt: app.schedule_link_sent_at,
          scheduleDeadlineAt: app.schedule_deadline_at,
          evaluatedAt: nowIso,
        },
        result: `Đã gửi thư nhắc đặt lịch phỏng vấn lần duy nhất (sau ${remindDays} ngày chưa đặt lịch).`,
        createdAt: nowIso,
      });

      NotificationService.send({
        applicationId: app.id,
        toEmail: app.email,
        templateKey: 'schedule_reminder',
        variables: {
          full_name: app.full_name,
          link: '/my-application',
          deadline: app.schedule_deadline_at
            ? new Date(app.schedule_deadline_at).toLocaleString('vi-VN')
            : '',
        },
        createdAt: nowIso,
      });

      remindedBookingCount += 1;
      affectedApplicationIds.push(app.id);
    }
  }

  return {
    scannedAt: nowIso,
    expiredSupplementsCount,
    remindedBookingCount,
    droppedNoBookingCount,
    affectedApplicationIds,
  };
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startBackgroundScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  // Poll every 10 seconds to support demo TIME_SCALE smoothly alongside 1-minute production scans
  schedulerInterval = setInterval(() => {
    try {
      runTimerTick(true);
    } catch (err) {
      console.error('Scheduler tick error:', err);
    }
  }, 10000);
}
