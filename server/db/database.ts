import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';

const dbPath = process.env.CRES_DB_PATH || path.join(os.tmpdir(), 'cres-recruit.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('candidate','hr','board','admin')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES recruitment_rounds(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quota INTEGER NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS application_missing_fields (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      round_no INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_decisions (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL CHECK(decision IN ('pass','fail')),
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interview_slots (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES recruitment_rounds(id) ON DELETE CASCADE,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      location_or_link TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      interviewer_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS scoring_criteria (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES recruitment_rounds(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      weight REAL NOT NULL,
      max_score REAL NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function getSetting(key: string, defaultValue: string = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : defaultValue;
}

export function setSetting(key: string, value: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
}

/**
 * Returns the virtual system clock (supporting TIME_SCALE and +1/+2 days time-travel).
 */
export function getSystemNow(): Date {
  const offsetMs = Number(getSetting('virtual_offset_ms', '0')) || 0;
  return new Date(Date.now() + offsetMs);
}

export function getSystemNowIso(): string {
  return getSystemNow().toISOString();
}
