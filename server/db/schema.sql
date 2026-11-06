-- ============================================================================
-- C-res Recruit — Database Schema (SQLite / PostgreSQL compatible DDL)
-- CLB C-res (Trường Đại học Kinh tế – Đại học Đà Nẵng)
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Bảng người dùng & phân quyền (Ứng viên, Ban Nhân sự, Ban Chủ nhiệm, Admin)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('candidate','hr','board','admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Bảng đợt tuyển dụng & cấu hình ngưỡng X/Y, bộ đếm giờ (Timers)
CREATE TABLE IF NOT EXISTS recruitment_rounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','open','closed')),
  open_at TEXT NOT NULL,
  close_at TEXT NOT NULL,
  supplement_max_rounds INTEGER NOT NULL DEFAULT 2,
  supplement_deadline_days REAL NOT NULL DEFAULT 2,
  remind_after_days REAL NOT NULL DEFAULT 1,
  unbook_after_days REAL NOT NULL DEFAULT 2,
  threshold_x REAL NOT NULL DEFAULT 75,
  threshold_y REAL NOT NULL DEFAULT 50,
  near_threshold_margin REAL NOT NULL DEFAULT 5,
  min_scorecards_per_interview INTEGER NOT NULL DEFAULT 1,
  group_link TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Bảng các Ban chuyên môn & chỉ tiêu (Quota)
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES recruitment_rounds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quota INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 4. Bảng hồ sơ ứng viên (Mỗi ứng viên là một Case trong quy trình TO-BE)
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES recruitment_rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  first_choice_dept_id TEXT NOT NULL,
  second_choice_dept_id TEXT,
  experience TEXT NOT NULL,
  essay TEXT NOT NULL,
  cv_url TEXT DEFAULT '',
  commitment_confirmed INTEGER NOT NULL DEFAULT 1,
  is_active_student INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  supplement_count INTEGER NOT NULL DEFAULT 0,
  supplement_deadline_at TEXT,
  schedule_link_sent_at TEXT,
  schedule_reminded_at TEXT,
  schedule_deadline_at TEXT,
  screening_score REAL,
  screening_result TEXT,
  is_near_threshold INTEGER NOT NULL DEFAULT 0,
  end_reason TEXT,
  withdraw_reason TEXT,
  submitted_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Bảng danh sách trường thiếu của từng lần yêu cầu bổ sung (Subprocess Bổ sung hồ sơ)
CREATE TABLE IF NOT EXISTS application_missing_fields (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  round_no INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Bảng quyết định duyệt tay của HR (Nhánh "Cần xem xét" & "Loại rõ gần ngưỡng")
CREATE TABLE IF NOT EXISTS review_decisions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK(decision IN ('pass','fail')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 7. Bảng khung giờ phỏng vấn (Interview Slots)
CREATE TABLE IF NOT EXISTS interview_slots (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES recruitment_rounds(id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  location_or_link TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  reserved_seats INTEGER NOT NULL DEFAULT 0,
  interviewer_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 8. Bảng đặt lịch phỏng vấn & trạng thái Check-in của ứng viên
CREATE TABLE IF NOT EXISTS interview_bookings (
  id TEXT PRIMARY KEY,
  application_id TEXT UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  slot_id TEXT NOT NULL REFERENCES interview_slots(id) ON DELETE CASCADE,
  booked_at TEXT NOT NULL,
  checked_in_at TEXT,
  no_show INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 9. Bảng tiêu chí chấm điểm phỏng vấn & trọng số (%)
CREATE TABLE IF NOT EXISTS scoring_criteria (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES recruitment_rounds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight REAL NOT NULL,
  max_score REAL NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 10. Bảng phiếu chấm điểm của từng giám khảo BCN (Mỗi giám khảo 1 phiếu độc lập)
CREATE TABLE IF NOT EXISTS scorecards (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  interviewer_id TEXT NOT NULL REFERENCES users(id),
  scores TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(application_id, interviewer_id)
);

-- 11. Bảng quyết định tuyển chọn của Ban Chủ nhiệm (Đậu / Dự bị / Rớt)
CREATE TABLE IF NOT EXISTS selection_decisions (
  id TEXT PRIMARY KEY,
  application_id TEXT UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  total_score REAL NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('pass','waitlist','fail')),
  decided_by TEXT NOT NULL REFERENCES users(id),
  note TEXT NOT NULL DEFAULT '',
  notified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 12. Bảng phân công vị trí/ban (Gợi ý của AI & Chốt bởi HR, hỗ trợ hoàn tác khi rút đơn)
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  application_id TEXT UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments(id),
  ai_suggested_dept_id TEXT,
  ai_reason TEXT,
  status TEXT NOT NULL CHECK(status IN ('suggested','confirmed','revoked')),
  confirmed_by TEXT,
  notified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 13. Bảng hộp thư thông báo tự động (Outbox)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','sent')),
  created_at TEXT NOT NULL
);

-- 14. Bảng nhật ký kiểm toán hệ thống (Audit Logs cho mọi quyết định tự động & thủ công)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  application_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  rule_applied TEXT NOT NULL,
  input_snapshot TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 15. Bảng cấu hình hệ thống (Đồng hồ giả lập, điều kiện cứng, mẫu thư)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
