export type UserRole = 'candidate' | 'hr' | 'board' | 'admin';

export type ApplicationStatus =
  | 'submitted'
  | 'checking'
  | 'needs_supplement'
  | 'supplement_submitted'
  | 'expired_supplement'
  | 'screening'
  | 'clear_pass'
  | 'needs_review'
  | 'clear_fail'
  | 'review_pass'
  | 'review_fail'
  | 'rejected_docs'
  | 'invited_to_book'
  | 'booked'
  | 'no_booking'
  | 'interviewing'
  | 'scored'
  | 'decided_pass'
  | 'decided_fail'
  | 'failed_interview'
  | 'offer_sent'
  | 'confirmed_joined'
  | 'assigned'
  | 'completed'
  | 'withdrawn';

export type EndReason =
  | 'expired_supplement' // Bị loại vì quá hạn
  | 'rejected_docs'      // Hồ sơ không đạt
  | 'no_booking'         // Ứng viên không tham gia
  | 'failed_interview'   // Ứng viên không đạt
  | 'withdrawn'          // Đã rút đơn
  | 'completed';         // Hoàn tất quy trình tuyển CTV

export const END_STATUSES: ApplicationStatus[] = [
  'expired_supplement',
  'rejected_docs',
  'no_booking',
  'failed_interview',
  'withdrawn',
  'completed',
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Đã nộp hồ sơ',
  checking: 'Đang kiểm tra hồ sơ',
  needs_supplement: 'Cần bổ sung hồ sơ',
  supplement_submitted: 'Đã nộp bổ sung',
  expired_supplement: 'Bị loại vì quá hạn',
  screening: 'Đang sơ loại',
  clear_pass: 'Đạt rõ (Vòng hồ sơ)',
  needs_review: 'Cần xem xét (Vòng hồ sơ)',
  clear_fail: 'Loại rõ (Sát ngưỡng - Chờ xem lại)',
  review_pass: 'Đạt vòng hồ sơ',
  review_fail: 'Hồ sơ không đạt',
  rejected_docs: 'Hồ sơ không đạt',
  invited_to_book: 'Chờ đặt lịch phỏng vấn',
  booked: 'Đã đặt lịch phỏng vấn',
  no_booking: 'Ứng viên không tham gia',
  interviewing: 'Đang phỏng vấn (Song song)',
  scored: 'Chờ BCN quyết định Đậu/Rớt',
  decided_pass: 'Đã chọn Đậu (Chờ chốt gửi TB)',
  decided_fail: 'Đã chọn Rớt (Chờ chốt gửi TB)',
  failed_interview: 'Ứng viên không đạt (Rớt PV)',
  offer_sent: 'Đã đậu — Chờ xác nhận vào nhóm',
  confirmed_joined: 'Đã vào nhóm — Chờ phân ban',
  assigned: 'Đã phân công Ban',
  completed: 'Hoàn tất quy trình tuyển CTV',
  withdrawn: 'Đã rút đơn',
};

export const END_REASON_LABELS: Record<EndReason, string> = {
  expired_supplement: 'Bị loại vì quá hạn',
  rejected_docs: 'Hồ sơ không đạt',
  no_booking: 'Ứng viên không tham gia',
  failed_interview: 'Ứng viên không đạt',
  withdrawn: 'Đã rút đơn',
  completed: 'Hoàn tất quy trình tuyển CTV',
};

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at?: string;
}

export interface RecruitmentRound {
  id: string;
  name: string;
  event_name: string;
  status: 'draft' | 'open' | 'closed';
  open_at: string;
  close_at: string;
  supplement_max_rounds: number;
  supplement_deadline_days: number;
  remind_after_days: number;
  unbook_after_days: number;
  threshold_x: number;
  threshold_y: number;
  near_threshold_margin: number;
  min_scorecards_per_interview: number;
  group_link: string;
}

export interface Department {
  id: string;
  round_id: string;
  name: string;
  quota: number;
  description: string;
  assigned_count?: number;
  remaining_quota?: number;
}

export interface ScoringCriterion {
  id: string;
  round_id: string;
  name: string;
  weight: number;
  max_score: number;
}

export interface Application {
  id: string;
  round_id: string;
  user_id: string;
  full_name: string;
  student_id: string;
  class_name: string;
  email: string;
  phone: string;
  first_choice_dept_id: string;
  second_choice_dept_id: string;
  experience: string;
  essay: string;
  cv_url: string;
  commitment_confirmed?: number;
  is_active_student?: number;
  status: ApplicationStatus;
  supplement_count: number;
  supplement_deadline_at: string | null;
  schedule_link_sent_at: string | null;
  schedule_reminded_at: string | null;
  schedule_deadline_at: string | null;
  screening_score: number | null;
  screening_result: 'clear_pass' | 'needs_review' | 'clear_fail' | null;
  is_near_threshold?: number;
  end_reason: EndReason | null;
  withdraw_reason?: string | null;
  submitted_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  first_choice_name?: string;
  second_choice_name?: string;
  missing_fields?: string[];
  booking?: InterviewBooking | null;
  scorecards?: Scorecard[];
  selection_decision?: SelectionDecision | null;
  assignment?: Assignment | null;
  review_decision?: ReviewDecision | null;
}

export interface ReviewDecision {
  id?: string;
  application_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  decision: 'pass' | 'fail';
  reason: string;
  created_at?: string;
}

export interface InterviewSlot {
  id: string;
  round_id: string;
  start_at: string;
  end_at: string;
  location_or_link: string;
  capacity: number;
  interviewer_ids: string[];
  booked_count?: number;
  bookings?: Array<{
    booking_id: string;
    application_id: string;
    full_name: string;
    student_id: string;
    first_choice_name: string;
    status: ApplicationStatus;
    checked_in_at: string | null;
    scorecard_count: number;
  }>;
}

export interface InterviewBooking {
  id: string;
  application_id: string;
  slot_id: string;
  booked_at: string;
  checked_in_at: string | null;
  no_show: number;
  start_at?: string;
  end_at?: string;
  location_or_link?: string;
}

export interface Scorecard {
  id: string;
  application_id: string;
  interviewer_id: string;
  interviewer_name?: string;
  scores: Record<string, number>;
  comment: string;
  submitted_at: string;
}

export interface SelectionDecision {
  id: string;
  application_id: string;
  total_score: number;
  decision: 'pass' | 'waitlist' | 'fail';
  decided_by: string;
  note: string;
  notified_at: string | null;
}

export interface Assignment {
  id: string;
  application_id: string;
  department_id: string;
  department_name?: string;
  ai_suggested_dept_id: string | null;
  ai_suggested_dept_name?: string | null;
  ai_reason: string | null;
  status: 'suggested' | 'confirmed' | 'revoked';
  confirmed_by: string | null;
  notified_at: string | null;
}

export interface NotificationItem {
  id: string;
  application_id: string;
  template_key: string;
  to_email: string;
  subject: string;
  body: string;
  status: 'queued' | 'sent';
  created_at: string;
  candidate_name?: string;
}

export interface AuditLogItem {
  id: string;
  application_id: string | null;
  actor: string;
  action: string;
  rule_applied: string;
  input_snapshot: string;
  result: string;
  created_at: string;
  candidate_name?: string;
}
