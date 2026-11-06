import type { ApplicationStatus } from '../../src/types.ts';

export interface ApplicationInputForCheck {
  full_name?: string | null;
  student_id?: string | null;
  class_name?: string | null;
  email?: string | null;
  phone?: string | null;
  first_choice_dept_id?: string | null;
  second_choice_dept_id?: string | null;
  experience?: string | null;
  essay?: string | null;
}

export const REQUIRED_FIELD_LABELS: Record<string, string> = {
  full_name: 'Họ và tên',
  student_id: 'Mã số sinh viên (MSSV)',
  class_name: 'Lớp sinh hoạt',
  email: 'Email liên hệ',
  phone: 'Số điện thoại',
  first_choice_dept_id: 'Ban nguyện vọng 1',
  experience: 'Kinh nghiệm hoạt động',
  essay: 'Câu hỏi tự luận',
};

/**
 * Pure function: Checks required fields on an application submission.
 * Returns list of missing field keys.
 */
export function checkRequiredFields(app: ApplicationInputForCheck): {
  isComplete: boolean;
  missingFields: string[];
} {
  const requiredKeys: Array<keyof ApplicationInputForCheck> = [
    'full_name',
    'student_id',
    'class_name',
    'email',
    'phone',
    'first_choice_dept_id',
    'experience',
    'essay',
  ];

  const missingFields: string[] = [];
  for (const key of requiredKeys) {
    const val = app[key];
    if (val === undefined || val === null || String(val).trim() === '') {
      missingFields.push(key);
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

export interface HardConditionsConfig {
  requireValidEmail: boolean;
  requireActiveStudentId: boolean;
  requireValidPhone: boolean;
  requireTimeCommitment: boolean;
}

export interface ScreeningInput {
  email: string;
  student_id: string;
  phone: string;
  class_name: string;
  experience: string;
  cv_url?: string | null;
  second_choice_dept_id?: string | null;
  commitment_confirmed?: boolean | number;
  is_active_student?: boolean | number;
}

/**
 * Pure function: Deterministic objective score calculation (0 - 100) + hard conditions check.
 * Note: Essay is NOT auto-graded by rule or AI (per Section 3.4: "Phần tự luận không chấm tự động, chỉ hiển thị cho người xem ở nhánh Cần xem xét").
 */
export function evaluateScreeningProfile(
  input: ScreeningInput,
  hardConfig: HardConditionsConfig = {
    requireValidEmail: true,
    requireActiveStudentId: true,
    requireValidPhone: true,
    requireTimeCommitment: true,
  }
): {
  hardConditionsPassed: boolean;
  violatedConditions: string[];
  score: number;
  scoreBreakdown: Record<string, number>;
} {
  const violatedConditions: string[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (hardConfig.requireValidEmail && !emailRegex.test((input.email || '').trim())) {
    violatedConditions.push('Email không hợp lệ');
  }

  // DUE student IDs typically 10-12 digits (e.g., 2111215211xx or 2211215142xx) or at least 6 alphanumeric chars
  const sid = (input.student_id || '').trim();
  const isStudentActive = input.is_active_student === undefined ? true : Boolean(input.is_active_student);
  if (hardConfig.requireActiveStudentId && (sid.length < 6 || !isStudentActive)) {
    violatedConditions.push('Không phải sinh viên đang học hoặc MSSV không hợp lệ');
  }

  const phoneClean = (input.phone || '').replace(/\s+/g, '');
  if (hardConfig.requireValidPhone && !/^0\d{8,10}$/.test(phoneClean)) {
    violatedConditions.push('Số điện thoại không đúng định dạng Việt Nam');
  }

  const committed = input.commitment_confirmed === undefined ? true : Boolean(input.commitment_confirmed);
  if (hardConfig.requireTimeCommitment && !committed) {
    violatedConditions.push('Chưa xác nhận cam kết thời gian tham gia sự kiện');
  }

  // Deterministic rule-based scoring on objective profile attributes (total 100 points):
  // 1. Academic info completeness (MSSV + Lớp DUE): 25 pts
  const academicScore = sid.length >= 8 && (input.class_name || '').trim().length >= 3 ? 25 : 15;

  // 2. Experience depth & relevance (based on structured length & keywords): up to 45 pts
  const expText = (input.experience || '').trim();
  let expScore = 0;
  if (expText.length >= 160) expScore = 40;
  else if (expText.length >= 90) expScore = 32;
  else if (expText.length >= 40) expScore = 22;
  else if (expText.length >= 15) expScore = 12;
  else expScore = 5;

  const expKeywords = ['clb', 'sự kiện', 'truyền thông', 'hậu cần', 'đối ngoại', 'nội dung', 'ban', 'ctv', 'tình nguyện', 'media', 'design', 'content', 'tài trợ'];
  const lowerExp = expText.toLowerCase();
  const matchedKeywords = expKeywords.filter((k) => lowerExp.includes(k)).length;
  expScore = Math.min(45, expScore + Math.min(5, matchedKeywords * 2));

  // 3. Department flexibility (has 2nd choice): 15 pts
  const choiceScore = (input.second_choice_dept_id || '').trim() ? 15 : 8;

  // 4. Portfolio / CV link attached: 15 pts
  const cvUrl = (input.cv_url || '').trim();
  const cvScore = cvUrl.startsWith('http://') || cvUrl.startsWith('https://') ? 15 : 5;

  const totalScore = Math.min(100, academicScore + expScore + choiceScore + cvScore);

  return {
    hardConditionsPassed: violatedConditions.length === 0,
    violatedConditions,
    score: totalScore,
    scoreBreakdown: {
      academic: academicScore,
      experience: expScore,
      choiceFlexibility: choiceScore,
      cvPortfolio: cvScore,
    },
  };
}

/**
 * Pure function: Screens candidate into 3 branches based on score and thresholds X, Y.
 * - clear_pass: hardConditionsPassed && score >= thresholdX
 * - clear_fail: !hardConditionsPassed || score < thresholdY
 * - needs_review: otherwise (thresholdY <= score < thresholdX and hardConditionsPassed)
 */
export function screenByThreshold(
  score: number,
  hardConditionsPassed: boolean,
  thresholdX: number,
  thresholdY: number
): 'clear_pass' | 'needs_review' | 'clear_fail' {
  if (!hardConditionsPassed || score < thresholdY) {
    return 'clear_fail';
  }
  if (score >= thresholdX) {
    return 'clear_pass';
  }
  return 'needs_review';
}

/**
 * Pure function: Checks whether a 'clear_fail' application is near threshold Y
 * (within [thresholdY - margin, thresholdY) and hard conditions passed, or within margin of Y).
 * Per Section 3.6: "Các hồ sơ 'Loại rõ' gần ngưỡng (cách Y không quá một biên độ cấu hình được, mặc định 5 điểm)
 * phải được đưa vào danh sách 'HR xem lại trước khi gửi'; thông báo loại chỉ gửi sau khi HR bấm xác nhận."
 */
export function isNearThreshold(
  score: number,
  hardConditionsPassed: boolean,
  thresholdY: number,
  margin: number = 5
): boolean {
  if (!hardConditionsPassed) return false;
  return score < thresholdY && score >= thresholdY - margin;
}

export interface CriterionWeight {
  id: string;
  weight: number; // e.g., 25 (meaning 25%) or 0.25
  max_score: number; // e.g., 10 or 100
}

/**
 * Pure function: Computes weighted average score across multiple scorecards, normalized to 100 scale.
 */
export function computeTotalScore(
  scorecards: Array<{ scores: Record<string, number> }>,
  criteria: CriterionWeight[]
): number {
  if (!scorecards.length || !criteria.length) return 0;

  const totalWeight = criteria.reduce((acc, c) => acc + c.weight, 0);
  if (totalWeight <= 0) return 0;

  const cardTotals = scorecards.map((card) => {
    let weightedSum = 0;
    for (const crit of criteria) {
      const raw = Number(card.scores?.[crit.id] ?? 0);
      const clamped = Math.max(0, Math.min(crit.max_score, raw));
      const normalized = crit.max_score > 0 ? (clamped / crit.max_score) * 100 : 0;
      weightedSum += normalized * (crit.weight / totalWeight);
    }
    return weightedSum;
  });

  const avg = cardTotals.reduce((a, b) => a + b, 0) / cardTotals.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Pure function: Computes available seats on an interview slot.
 * Formula: Chỗ trống = Tổng sức chứa − Booking đang giữ chỗ − Ghế dự trữ.
 */
export function computeSlotAvailableSeats(
  capacity: number,
  bookedCount: number,
  reservedSeats: number = 0
): number {
  const cap = Math.max(0, Number(capacity) || 0);
  const booked = Math.max(0, Number(bookedCount) || 0);
  const reserved = Math.max(0, Number(reservedSeats) || 0);
  return Math.max(0, cap - booked - reserved);
}

/**
 * Pure function: Checks if an interview slot can be booked by a candidate.
 */
export function canBook(
  slot: {
    id: string;
    capacity: number;
    booked_count: number;
    reserved_seats?: number;
    available_seats?: number;
    start_at: string;
  },
  existingBookingSlotId: string | null,
  nowIso: string
): { allowed: boolean; reason?: string } {
  if (existingBookingSlotId === slot.id) {
    return { allowed: false, reason: 'Bạn đã đặt khung giờ này rồi.' };
  }
  const reserved = Math.max(0, Number(slot.reserved_seats ?? 0));
  const available =
    slot.available_seats !== undefined
      ? Number(slot.available_seats)
      : computeSlotAvailableSeats(slot.capacity, slot.booked_count, reserved);

  if (available <= 0 || slot.booked_count + reserved >= slot.capacity) {
    return { allowed: false, reason: 'Khung giờ phỏng vấn này đã hết chỗ.' };
  }
  if (new Date(slot.start_at).getTime() <= new Date(nowIso).getTime()) {
    return { allowed: false, reason: 'Khung giờ phỏng vấn đã bắt đầu hoặc đã qua.' };
  }
  return { allowed: true };
}

/**
 * Pure function: Checks if a candidate in 'invited_to_book' should receive a 1-day reminder.
 * Must only remind once (schedule_reminded_at === null).
 */
export function shouldRemind(
  app: {
    status: ApplicationStatus;
    schedule_link_sent_at: string | null;
    schedule_reminded_at: string | null;
  },
  remindAfterDays: number,
  nowMs: number
): boolean {
  if (app.status !== 'invited_to_book') return false;
  if (app.schedule_reminded_at) return false;
  if (!app.schedule_link_sent_at) return false;

  const sentMs = new Date(app.schedule_link_sent_at).getTime();
  const thresholdMs = sentMs + remindAfterDays * 24 * 60 * 60 * 1000;
  return nowMs >= thresholdMs;
}

/**
 * Pure function: Checks if a candidate in 'invited_to_book' should be dropped after 2 days without booking.
 */
export function shouldDrop(
  app: {
    status: ApplicationStatus;
    schedule_deadline_at: string | null;
  },
  nowMs: number
): boolean {
  if (app.status !== 'invited_to_book') return false;
  if (!app.schedule_deadline_at) return false;
  return nowMs >= new Date(app.schedule_deadline_at).getTime();
}

/**
 * Pure function: Checks if a candidate in 'needs_supplement' has exceeded the 2-day supplement deadline.
 */
export function isSupplementExpired(
  app: {
    status: ApplicationStatus;
    supplement_deadline_at: string | null;
  },
  nowMs: number
): boolean {
  if (app.status !== 'needs_supplement') return false;
  if (!app.supplement_deadline_at) return false;
  return nowMs >= new Date(app.supplement_deadline_at).getTime();
}

/**
 * Pure function: Checks if interview AND-join condition is met:
 * Candidate has checked in AND number of submitted scorecards >= minScorecards.
 */
export function canConvergeInterviewAndJoin(
  checkedInAt: string | null | undefined,
  scorecardCount: number,
  minScorecards: number
): boolean {
  return Boolean(checkedInAt) && scorecardCount >= Math.max(1, minScorecards);
}

export const ALL_APPLICATION_STATUSES: ApplicationStatus[] = [
  'submitted',
  'checking',
  'needs_supplement',
  'supplement_submitted',
  'expired_supplement',
  'screening',
  'clear_pass',
  'needs_review',
  'clear_fail',
  'review_pass',
  'review_fail',
  'rejected_docs',
  'invited_to_book',
  'booked',
  'no_booking',
  'interviewing',
  'scored',
  'decided_pass',
  'decided_fail',
  'failed_interview',
  'offer_sent',
  'confirmed_joined',
  'assigned',
  'completed',
  'withdrawn',
];

/**
 * Valid transitions map for central state machine `transition(application, nextStatus)`
 */
export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ['checking', 'withdrawn'],
  checking: ['needs_supplement', 'screening', 'expired_supplement', 'withdrawn'],
  needs_supplement: ['supplement_submitted', 'expired_supplement', 'withdrawn'],
  supplement_submitted: ['checking', 'withdrawn'],
  expired_supplement: [],
  screening: ['clear_pass', 'needs_review', 'clear_fail', 'withdrawn'],
  clear_pass: ['invited_to_book', 'withdrawn'],
  needs_review: ['review_pass', 'review_fail', 'withdrawn'],
  clear_fail: ['rejected_docs', 'review_pass', 'withdrawn'],
  review_pass: ['invited_to_book', 'withdrawn'],
  review_fail: ['rejected_docs', 'withdrawn'],
  rejected_docs: [],
  invited_to_book: ['booked', 'no_booking', 'withdrawn'],
  booked: ['invited_to_book', 'interviewing', 'scored', 'withdrawn'],
  no_booking: [],
  interviewing: ['scored', 'withdrawn'],
  scored: ['decided_pass', 'decided_fail', 'withdrawn'],
  decided_pass: ['offer_sent', 'decided_fail', 'scored', 'withdrawn'],
  decided_fail: ['failed_interview', 'decided_pass', 'scored', 'withdrawn'],
  failed_interview: [],
  offer_sent: ['confirmed_joined', 'withdrawn'],
  confirmed_joined: ['assigned', 'withdrawn'],
  assigned: ['completed', 'withdrawn'],
  completed: ['withdrawn'],
  withdrawn: [],
};

export function isValidStateTransition(
  currentStatus: ApplicationStatus,
  nextStatus: ApplicationStatus
): boolean {
  if (!ALL_APPLICATION_STATUSES.includes(nextStatus)) return false;
  if (currentStatus === nextStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

/**
 * Pure deterministic fallback algorithm for department assignment when Gemini API is unavailable or returns invalid quota.
 * Ranks candidates by total_score DESC, assigns 1st choice if quota remains, else 2nd choice, else department with highest remaining quota.
 * When all departments have 0 remaining quota, returns departmentId: '' ("Chưa thể phân công").
 */
export function fallbackAssignmentSuggestion(
  candidates: Array<{
    applicationId: string;
    fullName: string;
    totalScore: number;
    firstChoiceDeptId: string;
    secondChoiceDeptId?: string | null;
    experience?: string;
  }>,
  departments: Array<{
    id: string;
    name: string;
    remainingQuota: number;
  }>
): Array<{
  applicationId: string;
  departmentId: string;
  reason: string;
}> {
  const remaining = new Map<string, { name: string; count: number }>();
  for (const d of departments) {
    remaining.set(d.id, { name: d.name, count: Math.max(0, d.remainingQuota) });
  }

  const sorted = [...candidates].sort((a, b) => b.totalScore - a.totalScore);
  const results: Array<{ applicationId: string; departmentId: string; reason: string }> = [];

  for (const cand of sorted) {
    const first = remaining.get(cand.firstChoiceDeptId);
    if (first && first.count > 0) {
      first.count -= 1;
      results.push({
        applicationId: cand.applicationId,
        departmentId: cand.firstChoiceDeptId,
        reason: `Điểm xét tuyển cao (${cand.totalScore.toFixed(1)}đ), khớp Nguyện vọng 1 (${first.name}) và ban còn chỉ tiêu.`,
      });
      continue;
    }

    if (cand.secondChoiceDeptId) {
      const second = remaining.get(cand.secondChoiceDeptId);
      if (second && second.count > 0) {
        second.count -= 1;
        results.push({
          applicationId: cand.applicationId,
          departmentId: cand.secondChoiceDeptId,
          reason: `Nguyện vọng 1 đã hết chỉ tiêu; phân bổ vào Nguyện vọng 2 (${second.name}) phù hợp với điểm số (${cand.totalScore.toFixed(1)}đ).`,
        });
        continue;
      }
    }

    // Fallback to any department with remaining quota > 0
    let bestDeptId = '';
    let maxRem = 0;
    for (const [deptId, info] of remaining.entries()) {
      if (info.count > maxRem) {
        maxRem = info.count;
        bestDeptId = deptId;
      }
    }

    if (!bestDeptId || maxRem <= 0) {
      results.push({
        applicationId: cand.applicationId,
        departmentId: '',
        reason: 'Chưa thể phân công: Tất cả các ban đã hết chỉ tiêu nhận CTV.',
      });
      continue;
    }

    const chosen = remaining.get(bestDeptId);
    if (chosen && chosen.count > 0) chosen.count -= 1;
    results.push({
      applicationId: cand.applicationId,
      departmentId: bestDeptId,
      reason: `Điều phối cân bằng chỉ tiêu sang ${chosen?.name || 'ban phù hợp'} do nguyện vọng 1–2 đã đủ số lượng.`,
    });
  }

  return results;
}
