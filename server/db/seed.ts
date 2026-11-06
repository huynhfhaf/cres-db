import bcrypt from 'bcryptjs';
import { db, getSetting, setSetting, getSystemNow, migrateDemoFullSlotsReservedSeats } from './database.ts';
import { DEFAULT_TEMPLATES, NotificationService } from '../services/notificationService.ts';
import { runAutomatedCheckAndScreenPipeline, writeAuditLog } from '../services/stateMachine.ts';
import { computeSlotAvailableSeats } from '../rules/rulesEngine.ts';

export const KINH_NGHIEM_A =
  'Em đã tham gia CLB và hỗ trợ tổ chức sự kiện sinh viên. Em từng viết nội dung truyền thông, thiết kế ấn phẩm, phối hợp hậu cần và làm việc nhóm. Em có thể hỗ trợ hoạt động tình nguyện, kết nối tài trợ và theo dõi tiến độ công việc.';
export const KINH_NGHIEM_B = 'Em có kinh nghiệm làm việc nhóm và sẵn sàng học hỏi.';
export const KINH_NGHIEM_C = 'Mới';
export const KINH_NGHIEM_D = 'clb';
export const TU_LUAN_CHUNG =
  'Em muốn tham gia C-RES để rèn kỹ năng làm việc nhóm và đóng góp cho hoạt động sinh viên. Em cam kết tham gia các buổi họp, hoàn thành nhiệm vụ được giao và trao đổi sớm khi có khó khăn.';

export interface QaCandidateSeedItem {
  readonly code: string;
  readonly userId: string;
  readonly appId: string;
  readonly full_name: string;
  readonly email: string;
  readonly student_id: string;
  readonly class_name: string;
  readonly phone: string;
  readonly first_choice_dept_id: string;
  readonly second_choice_dept_id: string;
  readonly experience: string;
  readonly essay: string;
  readonly cv_url: string;
  readonly commitment_confirmed: boolean;
  readonly is_active_student: boolean;
  readonly submitOnSeed: boolean;
}

/**
 * Immutable source dataset for the 17 QA sample candidates (C01–C17).
 * C01–C12 and C14–C17 are submitted on seed (16 applications).
 * C13 is created as an account only (submitOnSeed: false) so the user can test manual submission / link failure branch.
 */
export const QA_17_CANDIDATES: readonly QaCandidateSeedItem[] = Object.freeze(
  [
    {
      code: 'C01',
      userId: 'user-qa-c01',
      appId: 'app-qa-c01',
      full_name: 'TEST 01 Minh An',
      email: 'qa.cres.01@example.com',
      student_id: '990000000001',
      class_name: '50K14.2',
      phone: '0900000101',
      first_choice_dept_id: 'dept-media',
      second_choice_dept_id: 'dept-hr',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c01',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C02',
      userId: 'user-qa-c02',
      appId: 'app-qa-c02',
      full_name: 'TEST 02 Bao Binh',
      email: 'qa.cres.02@example.com',
      student_id: '990000000002',
      class_name: '50K14.2',
      phone: '',
      first_choice_dept_id: 'dept-hr',
      second_choice_dept_id: 'dept-business',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c02',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C03',
      userId: 'user-qa-c03',
      appId: 'app-qa-c03',
      full_name: 'TEST 03 Gia Chi',
      email: 'qa.cres.03@example.com',
      student_id: '990000000003',
      class_name: '50K14.2',
      phone: '0900000103',
      first_choice_dept_id: 'dept-business',
      second_choice_dept_id: 'dept-hr',
      experience: KINH_NGHIEM_A,
      essay: '',
      cv_url: 'https://example.com/cres-demo/cv-c03',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C04',
      userId: 'user-qa-c04',
      appId: 'app-qa-c04',
      full_name: 'TEST 04 Hoai Duong',
      email: 'qa.cres.04@example.com',
      student_id: '990000000004',
      class_name: '50K14.2',
      phone: '',
      first_choice_dept_id: 'dept-hr',
      second_choice_dept_id: 'dept-media',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c04',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C05',
      userId: 'user-qa-c05',
      appId: 'app-qa-c05',
      full_name: 'TEST 05 Khanh Ha',
      email: 'qa.cres.05@example.com',
      student_id: '990000000005',
      class_name: '50K14.2',
      phone: '0900000105',
      first_choice_dept_id: 'dept-business',
      second_choice_dept_id: 'dept-hr',
      experience: KINH_NGHIEM_B,
      essay: TU_LUAN_CHUNG,
      cv_url: '',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C06',
      userId: 'user-qa-c06',
      appId: 'app-qa-c06',
      full_name: 'TEST 06 Ngoc Hieu',
      email: 'qa.cres.06@example.com',
      student_id: '990000000006',
      class_name: '50K14.2',
      phone: '0900000106',
      first_choice_dept_id: 'dept-hr',
      second_choice_dept_id: 'dept-business',
      experience: KINH_NGHIEM_B,
      essay: TU_LUAN_CHUNG,
      cv_url: '',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C07',
      userId: 'user-qa-c07',
      appId: 'app-qa-c07',
      full_name: 'TEST 07 Quynh Khang',
      email: 'qa.cres.07@example.com',
      student_id: '990000000007',
      class_name: '50K14.2',
      phone: '0900000107',
      first_choice_dept_id: 'dept-business',
      second_choice_dept_id: '',
      experience: KINH_NGHIEM_C,
      essay: TU_LUAN_CHUNG,
      cv_url: '',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C08',
      userId: 'user-qa-c08',
      appId: 'app-qa-c08',
      full_name: 'TEST 08 Thanh Lam',
      email: 'qa.cres.08@example.com',
      student_id: '990000000008',
      class_name: '50K14.2',
      phone: '0900000108',
      first_choice_dept_id: 'dept-media',
      second_choice_dept_id: '',
      experience: KINH_NGHIEM_D,
      essay: TU_LUAN_CHUNG,
      cv_url: '',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C09',
      userId: 'user-qa-c09',
      appId: 'app-qa-c09',
      full_name: 'TEST 09 Nhat Minh',
      email: 'qa.cres.09@example.com',
      student_id: '990000000009',
      class_name: '50K14.2',
      phone: '0900000109',
      first_choice_dept_id: 'dept-business',
      second_choice_dept_id: 'dept-hr',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c09',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C10',
      userId: 'user-qa-c10',
      appId: 'app-qa-c10',
      full_name: 'TEST 10 Thao Nhi',
      email: 'qa.cres.10@example.com',
      student_id: '990000000010',
      class_name: '50K14.2',
      phone: '0900000110',
      first_choice_dept_id: 'dept-hr',
      second_choice_dept_id: 'dept-media',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c10',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C11',
      userId: 'user-qa-c11',
      appId: 'app-qa-c11',
      full_name: 'TEST 11 Viet Phuc',
      email: 'qa.cres.11@example.com',
      student_id: '990000000011',
      class_name: '50K14.2',
      phone: '0900000111',
      first_choice_dept_id: 'dept-media',
      second_choice_dept_id: 'dept-hr',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c11',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C12',
      userId: 'user-qa-c12',
      appId: 'app-qa-c12',
      full_name: 'TEST 12 Mai Quynh',
      email: 'qa.cres.12@example.com',
      student_id: '990000000012',
      class_name: '50K14.2',
      phone: '0900000112',
      first_choice_dept_id: 'dept-media',
      second_choice_dept_id: 'dept-business',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c12',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C13',
      userId: 'user-qa-c13',
      appId: 'app-qa-c13',
      full_name: 'TEST 13 Duc Son',
      email: 'qa.cres.13@example.com',
      student_id: '990000000013',
      class_name: '50K14.2',
      phone: '0900000113',
      first_choice_dept_id: 'dept-business',
      second_choice_dept_id: 'dept-hr',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c13',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: false,
    },
    {
      code: 'C14',
      userId: 'user-qa-c14',
      appId: 'app-qa-c14',
      full_name: 'TEST 14 Thu Trang',
      email: 'qa.cres.14@example.com',
      student_id: '990000000014',
      class_name: '50K14.2',
      phone: '0900000114',
      first_choice_dept_id: 'dept-hr',
      second_choice_dept_id: 'dept-business',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c14',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C15',
      userId: 'user-qa-c15',
      appId: 'app-qa-c15',
      full_name: 'TEST 15 Hai Uyen',
      email: 'qa.cres.15@example.com',
      student_id: '990000000015',
      class_name: '50K14.2',
      phone: '0900000115',
      first_choice_dept_id: 'dept-business',
      second_choice_dept_id: 'dept-hr',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c15',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C16',
      userId: 'user-qa-c16',
      appId: 'app-qa-c16',
      full_name: 'TEST 16 Tuan Vy',
      email: 'qa.cres.16@example.com',
      student_id: '990000000016',
      class_name: '50K14.2',
      phone: '0900000116',
      first_choice_dept_id: 'dept-media',
      second_choice_dept_id: 'dept-business',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c16',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
    {
      code: 'C17',
      userId: 'user-qa-c17',
      appId: 'app-qa-c17',
      full_name: 'TEST 17 Yen Xuan',
      email: 'qa.cres.17@example.com',
      student_id: '990000000017',
      class_name: '50K14.2',
      phone: '0900000117',
      first_choice_dept_id: 'dept-business',
      second_choice_dept_id: 'dept-hr',
      experience: KINH_NGHIEM_A,
      essay: TU_LUAN_CHUNG,
      cv_url: 'https://example.com/cres-demo/cv-c17',
      commitment_confirmed: true,
      is_active_student: true,
      submitOnSeed: true,
    },
  ].map((item) => Object.freeze(item))
);

export const DEMO_FULL_SLOTS_SPEC = Object.freeze([
  Object.freeze({
    id: 'slot-demo-full-a',
    location_or_link: 'DEMO_FULL_A',
    startOffsetHours: 74,
    endOffsetHours: 75,
    defaultCapacity: 6,
    defaultReservedSeats: 0,
  }),
  Object.freeze({
    id: 'slot-demo-full-b',
    location_or_link: 'DEMO_FULL_B',
    startOffsetHours: 76,
    endOffsetHours: 77,
    defaultCapacity: 6,
    defaultReservedSeats: 4,
  }),
  Object.freeze({
    id: 'slot-demo-full-c',
    location_or_link: 'DEMO_FULL_C',
    startOffsetHours: 78,
    endOffsetHours: 79,
    defaultCapacity: 6,
    defaultReservedSeats: 5,
  }),
]);

/**
 * Syncs DEMO_FULL_A, DEMO_FULL_B, DEMO_FULL_C relative to T0 (when they have 0 bookings),
 * preserving each slot's total capacity (6) and reserved_seats configuration.
 */
export function syncDemoFullSlotsForT0(
  roundId: string,
  t0Iso: string
): Array<{
  id: string;
  location_or_link: string;
  start_at: string;
  end_at: string;
  capacity: number;
  reserved_seats: number;
  booked_count: number;
  available_seats: number;
  updated: boolean;
}> {
  migrateDemoFullSlotsReservedSeats();

  const t0Ms = new Date(t0Iso).getTime();
  const findSlot = db.prepare(
    'SELECT id, start_at, end_at, location_or_link, capacity, COALESCE(reserved_seats, 0) as reserved_seats FROM interview_slots WHERE round_id = ? AND (location_or_link = ? OR id = ?) LIMIT 1'
  );
  const countBookings = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM interview_bookings b
    JOIN applications a ON a.id = b.application_id
    WHERE b.slot_id = ? AND a.status != 'withdrawn'
  `);
  const insertSlot = db.prepare(`
    INSERT INTO interview_slots (id, round_id, start_at, end_at, location_or_link, capacity, reserved_seats, interviewer_ids, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateSlotTime = db.prepare(`
    UPDATE interview_slots
    SET start_at = ?, end_at = ?, updated_at = ?
    WHERE id = ?
  `);

  const out: Array<{
    id: string;
    location_or_link: string;
    start_at: string;
    end_at: string;
    capacity: number;
    reserved_seats: number;
    booked_count: number;
    available_seats: number;
    updated: boolean;
  }> = [];

  for (const spec of DEMO_FULL_SLOTS_SPEC) {
    const startIso = new Date(t0Ms + spec.startOffsetHours * 3600 * 1000).toISOString();
    const endIso = new Date(t0Ms + spec.endOffsetHours * 3600 * 1000).toISOString();

    const existing = findSlot.get(roundId, spec.location_or_link, spec.id) as
      | {
          id: string;
          start_at: string;
          end_at: string;
          location_or_link: string;
          capacity: number;
          reserved_seats: number;
        }
      | undefined;

    if (!existing) {
      insertSlot.run(
        spec.id,
        roundId,
        startIso,
        endIso,
        spec.location_or_link,
        spec.defaultCapacity,
        spec.defaultReservedSeats,
        JSON.stringify(['user-board-01', 'user-board-02']),
        t0Iso,
        t0Iso
      );
      out.push({
        id: spec.id,
        location_or_link: spec.location_or_link,
        start_at: startIso,
        end_at: endIso,
        capacity: spec.defaultCapacity,
        reserved_seats: spec.defaultReservedSeats,
        booked_count: 0,
        available_seats: computeSlotAvailableSeats(spec.defaultCapacity, 0, spec.defaultReservedSeats),
        updated: true,
      });
      continue;
    }

    const bookedRow = countBookings.get(existing.id) as { cnt: number };
    const bookedCount = bookedRow.cnt;
    const availableSeats = computeSlotAvailableSeats(existing.capacity, bookedCount, existing.reserved_seats);

    if (bookedCount === 0) {
      // Update start_at and end_at relative to new T0 while keeping existing.capacity and existing.reserved_seats intact
      updateSlotTime.run(startIso, endIso, t0Iso, existing.id);
      out.push({
        id: existing.id,
        location_or_link: existing.location_or_link,
        start_at: startIso,
        end_at: endIso,
        capacity: existing.capacity,
        reserved_seats: existing.reserved_seats,
        booked_count: 0,
        available_seats: availableSeats,
        updated: true,
      });
    } else {
      out.push({
        id: existing.id,
        location_or_link: existing.location_or_link,
        start_at: existing.start_at,
        end_at: existing.end_at,
        capacity: existing.capacity,
        reserved_seats: existing.reserved_seats,
        booked_count: bookedCount,
        available_seats: availableSeats,
        updated: false,
      });
    }
  }

  return out;
}

/**
 * Resets the current demo recruitment round to 0 applications ("Đặt lại đợt tuyển trống (0 hồ sơ)"):
 * - Deletes all processing data of the current round: applications, missing fields, bookings, check-ins,
 *   scorecards, review decisions, selection decisions, assignments, notifications, and audit logs.
 * - Removes test/sample candidate accounts not used in any other recruitment round.
 * - Clears `sample_seed_t0_iso` so the next sample load establishes a fresh T0.
 * - Preserves internal accounts (Admin, HR/BNS, Board/BCN), round thresholds/deadlines/settings,
 *   departments & original quotas, DEMO_FULL_A/B/C slots & their configured capacities, and other rounds' data.
 */
export function resetCurrentRoundToEmpty(): {
  roundId: string;
  seededUsers: number;
  seededApplications: number;
  deletedApplications: number;
  deletedCandidateUsers: number;
  mode: 'empty';
} {
  // Ensure base schema/round exists if DB was completely empty
  const roundCount = db.prepare('SELECT COUNT(*) as cnt FROM recruitment_rounds').get() as { cnt: number };
  if (roundCount.cnt === 0) {
    seedDatabase(true, false);
  }

  const currentRound = db
    .prepare('SELECT id FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
    .get() as { id: string } | undefined;

  if (!currentRound) {
    return {
      roundId: '',
      seededUsers: 0,
      seededApplications: 0,
      deletedApplications: 0,
      deletedCandidateUsers: 0,
      mode: 'empty',
    };
  }

  const roundId = currentRound.id;
  migrateDemoFullSlotsReservedSeats();

  const tx = db.transaction(() => {
    const appRows = db
      .prepare('SELECT id FROM applications WHERE round_id = ?')
      .all(roundId) as Array<{ id: string }>;
    const appIds = appRows.map((a) => a.id);

    if (appIds.length > 0) {
      db.prepare(
        'DELETE FROM audit_logs WHERE application_id IN (SELECT id FROM applications WHERE round_id = ?)'
      ).run(roundId);
      db.prepare(
        'DELETE FROM notifications WHERE application_id IN (SELECT id FROM applications WHERE round_id = ?)'
      ).run(roundId);
      db.prepare(
        'DELETE FROM assignments WHERE application_id IN (SELECT id FROM applications WHERE round_id = ?)'
      ).run(roundId);
      db.prepare(
        'DELETE FROM selection_decisions WHERE application_id IN (SELECT id FROM applications WHERE round_id = ?)'
      ).run(roundId);
      db.prepare(
        'DELETE FROM scorecards WHERE application_id IN (SELECT id FROM applications WHERE round_id = ?)'
      ).run(roundId);
      db.prepare(
        'DELETE FROM review_decisions WHERE application_id IN (SELECT id FROM applications WHERE round_id = ?)'
      ).run(roundId);
      db.prepare(
        'DELETE FROM application_missing_fields WHERE application_id IN (SELECT id FROM applications WHERE round_id = ?)'
      ).run(roundId);
    }

    // Also clear any bookings on slots belonging to this round
    db.prepare(`
      DELETE FROM interview_bookings
      WHERE application_id IN (SELECT id FROM applications WHERE round_id = ?)
         OR slot_id IN (SELECT id FROM interview_slots WHERE round_id = ?)
    `).run(roundId, roundId);

    // Delete all applications of the current round
    const delAppsRes = db.prepare('DELETE FROM applications WHERE round_id = ?').run(roundId);

    // Clear round-level audit logs that are not tied to another round's applications
    db.prepare('DELETE FROM audit_logs WHERE application_id IS NULL').run();

    // Remove candidate accounts from this test run if they are not used in any other round
    const delUsersRes = db
      .prepare(`
        DELETE FROM users
        WHERE role = 'candidate'
          AND id != 'user-cand-default'
          AND id NOT IN (SELECT DISTINCT user_id FROM applications)
      `)
      .run();

    // Clear T0 marker so next sample seed starts a fresh T0
    db.prepare("DELETE FROM settings WHERE key IN ('sample_seed_t0_iso', 'qa_slots_t0_iso')").run();

    return {
      roundId,
      seededUsers: 0,
      seededApplications: 0,
      deletedApplications: delAppsRes.changes,
      deletedCandidateUsers: delUsersRes.changes,
      mode: 'empty' as const,
    };
  });

  return tx();
}

export interface Qa17SeedResultItem {
  code: string;
  email: string;
  userOutcome: 'created' | 'existed';
  appOutcome: 'created' | 'existed' | 'unsubmitted_account_only';
  status: string | null;
  screening_score: number | null;
}

/**
 * Seeds the 17 QA sample candidates ("Nạp dữ liệu mẫu (17 ứng viên)"):
 * - Creates 17 accounts (C01–C17) with password CresDemo2026!.
 * - Submits 16 applications (C01–C12, C14–C17) through runAutomatedCheckAndScreenPipeline.
 * - Leaves C13 as an unsubmitted candidate account (0 application row).
 * - If sample candidates already exist in the current round, does NOT duplicate, does NOT overwrite progress,
 *   does NOT change T0, and does NOT shift DEMO_FULL_A/B/C slot times.
 * - On a fresh load (after reset), captures current backend clock as T0 and updates unbooked DEMO_FULL_A/B/C slots
 *   to T0+74..75h, T0+76..77h, T0+78..79h while preserving their configured capacities.
 */
export function seedSample17Candidates(): {
  roundId: string;
  seededUsers: number;
  seededApplications: number;
  existingUsers: number;
  existingApplications: number;
  totalSampleUsers: number;
  totalApplications: number;
  alreadySeeded: boolean;
  t0Iso: string;
  demoSlots: ReturnType<typeof syncDemoFullSlotsForT0>;
  items: Qa17SeedResultItem[];
  mode: 'sample';
} {
  // Ensure base schema/round exists if DB was completely empty
  const roundCount = db.prepare('SELECT COUNT(*) as cnt FROM recruitment_rounds').get() as { cnt: number };
  if (roundCount.cnt === 0) {
    seedDatabase(true, false);
  }

  const round = db
    .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
    .get() as { id: string; open_at: string; close_at: string } | undefined;

  if (!round) {
    return {
      roundId: '',
      seededUsers: 0,
      seededApplications: 0,
      existingUsers: 0,
      existingApplications: 0,
      totalSampleUsers: 0,
      totalApplications: 0,
      alreadySeeded: false,
      t0Iso: getSystemNow().toISOString(),
      demoSlots: [],
      items: [],
      mode: 'sample',
    };
  }

  const sampleEmails = QA_17_CANDIDATES.map((c) => c.email);
  const placeholders = sampleEmails.map(() => '?').join(',');
  const existingSampleUsersRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM users WHERE email IN (${placeholders})`)
    .get(...sampleEmails) as { cnt: number };
  const existingSampleAppsRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM applications WHERE round_id = ? AND email IN (${placeholders})`)
    .get(round.id, ...sampleEmails) as { cnt: number };

  const alreadyHasSampleData = existingSampleUsersRow.cnt > 0 || existingSampleAppsRow.cnt > 0;

  if (alreadyHasSampleData) {
    // Do NOT alter T0, do NOT shift slot times, do NOT overwrite or create duplicate sample records
    const savedT0 = getSetting('sample_seed_t0_iso', '') || getSetting('qa_slots_t0_iso', '') || getSystemNow().toISOString();
    const findUserByEmail = db.prepare('SELECT id FROM users WHERE email = ?');
    const findAppByEmail = db.prepare(
      'SELECT id, status, screening_score FROM applications WHERE round_id = ? AND email = ? LIMIT 1'
    );

    const items: Qa17SeedResultItem[] = QA_17_CANDIDATES.map((c) => {
      const u = findUserByEmail.get(c.email) as { id: string } | undefined;
      const a = findAppByEmail.get(round.id, c.email) as
        | { id: string; status: string; screening_score: number | null }
        | undefined;
      return {
        code: c.code,
        email: c.email,
        userOutcome: u ? 'existed' : 'created',
        appOutcome: a ? 'existed' : 'unsubmitted_account_only',
        status: a ? a.status : null,
        screening_score: a ? a.screening_score : null,
      };
    });

    const totalAppsRow = db
      .prepare('SELECT COUNT(*) as cnt FROM applications WHERE round_id = ?')
      .get(round.id) as { cnt: number };

    const countBookings = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM interview_bookings b
      JOIN applications a ON a.id = b.application_id
      WHERE b.slot_id = ? AND a.status != 'withdrawn'
    `);

    const existingDemoSlots = db
      .prepare(
        "SELECT id, location_or_link, start_at, end_at, capacity, COALESCE(reserved_seats, 0) as reserved_seats FROM interview_slots WHERE round_id = ? AND location_or_link IN ('DEMO_FULL_A', 'DEMO_FULL_B', 'DEMO_FULL_C') ORDER BY start_at ASC"
      )
      .all(round.id) as Array<{
      id: string;
      location_or_link: string;
      start_at: string;
      end_at: string;
      capacity: number;
      reserved_seats: number;
    }>;

    return {
      roundId: round.id,
      seededUsers: 0,
      seededApplications: 0,
      existingUsers: existingSampleUsersRow.cnt,
      existingApplications: existingSampleAppsRow.cnt,
      totalSampleUsers: existingSampleUsersRow.cnt,
      totalApplications: totalAppsRow.cnt,
      alreadySeeded: true,
      t0Iso: savedT0,
      demoSlots: existingDemoSlots.map((s) => {
        const bRow = countBookings.get(s.id) as { cnt: number };
        const bookedCount = bRow.cnt;
        return {
          ...s,
          booked_count: bookedCount,
          available_seats: computeSlotAvailableSeats(s.capacity, bookedCount, s.reserved_seats),
          updated: false,
        };
      }),
      items,
      mode: 'sample',
    };
  }

  // Fresh sample load: capture current backend clock as T0
  const baseNow = getSystemNow();
  const t0Iso = baseNow.toISOString();
  setSetting('sample_seed_t0_iso', t0Iso);

  // Ensure round open/close window encompasses T0 so submissions are valid
  const openMs = Date.parse(round.open_at);
  const closeMs = Date.parse(round.close_at);
  if (Number.isNaN(openMs) || baseNow.getTime() < openMs) {
    db.prepare('UPDATE recruitment_rounds SET open_at = ? WHERE id = ?').run(
      new Date(baseNow.getTime() - 7 * 24 * 3600 * 1000).toISOString(),
      round.id
    );
  }
  if (Number.isNaN(closeMs) || baseNow.getTime() > closeMs) {
    db.prepare('UPDATE recruitment_rounds SET close_at = ? WHERE id = ?').run(
      new Date(baseNow.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
      round.id
    );
  }

  // Update DEMO_FULL_A (+74..75h), DEMO_FULL_B (+76..77h), DEMO_FULL_C (+78..79h) relative to T0 (preserving capacity)
  const demoSlots = syncDemoFullSlotsForT0(round.id, t0Iso);

  const passwordHash = bcrypt.hashSync('CresDemo2026!', 8);
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'candidate', ?, ?)
  `);
  const insertApp = db.prepare(`
    INSERT INTO applications (
      id, round_id, user_id, full_name, student_id, class_name, email, phone,
      first_choice_dept_id, second_choice_dept_id, experience, essay, cv_url,
      commitment_confirmed, is_active_student,
      status, supplement_count, submitted_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      'submitted', 0, ?, ?, ?
    )
  `);

  let seededUsers = 0;
  let seededApplications = 0;
  const items: Qa17SeedResultItem[] = [];

  for (let i = 0; i < QA_17_CANDIDATES.length; i++) {
    const c = QA_17_CANDIDATES[i];
    // Stagger timestamps by 1ms so C01..C17 preserve deterministic order while all belonging to T0
    const itemIso = new Date(baseNow.getTime() - i).toISOString();

    insertUser.run(c.userId, c.email, passwordHash, c.full_name, itemIso, itemIso);
    seededUsers += 1;

    if (!c.submitOnSeed) {
      // C13: only create the account, do not submit an application yet
      items.push({
        code: c.code,
        email: c.email,
        userOutcome: 'created',
        appOutcome: 'unsubmitted_account_only',
        status: null,
        screening_score: null,
      });
      continue;
    }

    insertApp.run(
      c.appId,
      round.id,
      c.userId,
      c.full_name,
      String(c.student_id),
      c.class_name,
      c.email,
      String(c.phone),
      c.first_choice_dept_id,
      c.second_choice_dept_id,
      c.experience,
      c.essay,
      c.cv_url,
      c.commitment_confirmed ? 1 : 0,
      c.is_active_student ? 1 : 0,
      itemIso,
      itemIso,
      itemIso
    );

    writeAuditLog({
      applicationId: c.appId,
      actor: `user:${c.userId}`,
      action: 'SUBMIT_APPLICATION',
      ruleApplied: 'Candidate Form Submission -> Start Case',
      inputSnapshot: {
        full_name: c.full_name,
        student_id: String(c.student_id),
        class_name: c.class_name,
        first_choice_dept_id: c.first_choice_dept_id,
      },
      result: 'Ứng viên đã nộp đơn đăng ký CTV.',
      createdAt: itemIso,
    });

    const processed = runAutomatedCheckAndScreenPipeline(c.appId, 'system');
    seededApplications += 1;
    items.push({
      code: c.code,
      email: c.email,
      userOutcome: 'created',
      appOutcome: 'created',
      status: processed.status,
      screening_score: processed.screening_score,
    });
  }

  const totalAppsRow = db
    .prepare('SELECT COUNT(*) as cnt FROM applications WHERE round_id = ?')
    .get(round.id) as { cnt: number };

  return {
    roundId: round.id,
    seededUsers,
    seededApplications,
    existingUsers: 0,
    existingApplications: 0,
    totalSampleUsers: seededUsers,
    totalApplications: totalAppsRow.cnt,
    alreadySeeded: false,
    t0Iso,
    demoSlots,
    items,
    mode: 'sample',
  };
}

export function seedDatabase(
  forceReset: boolean = false,
  withSampleCandidates: boolean = false
): {
  roundId: string;
  seededUsers?: number;
  seededApplications: number;
  mode: 'empty' | 'sample';
} {
  const baseNow = getSystemNow();
  const isoAt = (offsetHours: number) => new Date(baseNow.getTime() + offsetHours * 3600 * 1000).toISOString();

  const existingUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  const legacyDeptCheck = db
    .prepare("SELECT COUNT(*) as cnt FROM departments WHERE id NOT IN ('dept-media', 'dept-hr', 'dept-business')")
    .get() as { cnt: number };

  if (existingUsers.cnt > 0 && !forceReset && legacyDeptCheck.cnt === 0) {
    const round = db.prepare('SELECT id FROM recruitment_rounds LIMIT 1').get() as { id: string } | undefined;
    const appCnt = db.prepare('SELECT COUNT(*) as cnt FROM applications').get() as { cnt: number };
    return {
      roundId: round?.id || '',
      seededApplications: appCnt.cnt,
      mode: appCnt.cnt > 0 ? 'sample' : 'empty',
    };
  }

  const passwordHash = bcrypt.hashSync('123456', 8);

  const tx = db.transaction(() => {
    // Clear all tables in reverse dependency order
    db.exec(`
      DELETE FROM audit_logs;
      DELETE FROM notifications;
      DELETE FROM assignments;
      DELETE FROM selection_decisions;
      DELETE FROM scorecards;
      DELETE FROM scoring_criteria;
      DELETE FROM interview_bookings;
      DELETE FROM interview_slots;
      DELETE FROM review_decisions;
      DELETE FROM application_missing_fields;
      DELETE FROM applications;
      DELETE FROM departments;
      DELETE FROM recruitment_rounds;
      DELETE FROM users;
      DELETE FROM settings;
    `);

    // Reset virtual clock offset
    setSetting('virtual_offset_ms', '0');
    setSetting('TIME_SCALE', process.env.TIME_SCALE || '1');
    setSetting(
      'hard_conditions',
      JSON.stringify({
        requireValidEmail: true,
        requireActiveStudentId: true,
        requireValidPhone: true,
        requireTimeCommitment: true,
      })
    );
    NotificationService.saveTemplates(DEFAULT_TEMPLATES);

    // 1. Create Internal Club Users (Admin, HR/BNS, Board/BCN)
    const adminId = 'user-admin-01';
    const hrId = 'user-hr-01';
    const board1Id = 'user-board-01';
    const board2Id = 'user-board-02';

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      adminId,
      'admin@cres.due.udn.vn',
      passwordHash,
      'Trần Minh Quân (Quản trị viên)',
      'admin',
      isoAt(-240),
      isoAt(-240)
    );
    insertUser.run(
      hrId,
      'hr@cres.due.udn.vn',
      passwordHash,
      'Lê Hoàng Bảo Trân (Trưởng Ban Nhân sự)',
      'hr',
      isoAt(-240),
      isoAt(-240)
    );
    insertUser.run(
      board1Id,
      'bcn@cres.due.udn.vn',
      passwordHash,
      'Nguyễn Đức Thịnh (Chủ nhiệm CLB)',
      'board',
      isoAt(-240),
      isoAt(-240)
    );
    insertUser.run(
      board2Id,
      'pho.bcn@cres.due.udn.vn',
      passwordHash,
      'Phạm Ngọc Khánh Linh (Phó Chủ nhiệm)',
      'board',
      isoAt(-240),
      isoAt(-240)
    );
    insertUser.run(
      'user-cand-default',
      'ungvien@due.udn.vn',
      passwordHash,
      'Nguyễn Văn Ứng Viên',
      'candidate',
      isoAt(-240),
      isoAt(-240)
    );

    // 2. Create 1 Active Recruitment Round (open window: -7 days to +30 days)
    const roundId = 'round-2026-autumn';
    db.prepare(`
      INSERT INTO recruitment_rounds (
        id, name, event_name, status, open_at, close_at,
        supplement_max_rounds, supplement_deadline_days, remind_after_days, unbook_after_days,
        threshold_x, threshold_y, near_threshold_margin, min_scorecards_per_interview, group_link,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'open', ?, ?, 2, 2, 1, 2, 75, 50, 5, 1, ?, ?, ?)
    `).run(
      roundId,
      'Đợt Tuyển Cộng Tác Viên Mùa Thu 2026',
      'Câu lạc bộ Thương mại C-RES — Đại học Kinh tế - Đại học Đà Nẵng',
      isoAt(-168),
      isoAt(720),
      'https://zalo.me/g/cres-ctv-gen2026-due',
      isoAt(-168),
      isoAt(-1)
    );

    // 3. Create 3 Departments (Truyền thông, Nhân sự, Kinh doanh)
    const depts = [
      {
        id: 'dept-media',
        name: 'Ban Truyền thông',
        quota: 8,
        description:
          'Quản trị fanpage, sáng tạo nội dung, thiết kế ấn phẩm và truyền thông các hoạt động của Câu lạc bộ Thương mại C-RES.',
      },
      {
        id: 'dept-hr',
        name: 'Ban Nhân sự',
        quota: 7,
        description:
          'Tuyển dụng, đào tạo, gắn kết thành viên và điều phối công tác tổ chức nội bộ của Câu lạc bộ Thương mại C-RES.',
      },
      {
        id: 'dept-business',
        name: 'Ban Kinh doanh',
        quota: 7,
        description:
          'Lập kế hoạch thương mại, kết nối đối tác doanh nghiệp và vận hành dự án thực tế của Câu lạc bộ Thương mại C-RES.',
      },
    ];

    const insertDept = db.prepare(`
      INSERT INTO departments (id, round_id, name, quota, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const d of depts) {
      insertDept.run(d.id, roundId, d.name, d.quota, d.description, isoAt(-168), isoAt(-168));
    }

    // 4. Create 5 Scoring Criteria with Weights (sum = 100)
    const criteria = [
      { id: 'crit-attitude', name: 'Thái độ & Mức độ cam kết đồng hành', weight: 25, max_score: 10 },
      { id: 'crit-skill', name: 'Kỹ năng chuyên môn theo Ban ứng tuyển', weight: 25, max_score: 10 },
      { id: 'crit-problem', name: 'Tư duy xử lý tình huống thực tế', weight: 20, max_score: 10 },
      { id: 'crit-teamwork', name: 'Kỹ năng giao tiếp & Làm việc nhóm', weight: 15, max_score: 10 },
      { id: 'crit-culture', name: 'Sự phù hợp với văn hóa Câu lạc bộ Thương mại C-RES', weight: 15, max_score: 10 },
    ];
    const insertCrit = db.prepare(`
      INSERT INTO scoring_criteria (id, round_id, name, weight, max_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of criteria) {
      insertCrit.run(c.id, roundId, c.name, c.weight, c.max_score, isoAt(-168), isoAt(-168));
    }

    // 5. Create Interview Slots including DEMO_FULL_A (cap 6, reserved 0), DEMO_FULL_B (cap 6, reserved 4), DEMO_FULL_C (cap 6, reserved 5)
    const slots = [
      {
        id: 'slot-1',
        start_at: isoAt(24),
        end_at: isoAt(26),
        location: 'Phòng B203 - Đại học Kinh tế - Đại học Đà Nẵng',
        cap: 6,
        reserved: 0,
      },
      {
        id: 'slot-2',
        start_at: isoAt(48),
        end_at: isoAt(50),
        location: 'Phòng B203 - Đại học Kinh tế - Đại học Đà Nẵng',
        cap: 6,
        reserved: 0,
      },
      {
        id: 'slot-3',
        start_at: isoAt(72),
        end_at: isoAt(74),
        location: 'Phòng C302 - Đại học Kinh tế - Đại học Đà Nẵng',
        cap: 6,
        reserved: 0,
      },
      {
        id: 'slot-4',
        start_at: isoAt(96),
        end_at: isoAt(98),
        location: 'Phòng H101 - Đại học Kinh tế - Đại học Đà Nẵng',
        cap: 6,
        reserved: 0,
      },
      {
        id: 'slot-5',
        start_at: isoAt(120),
        end_at: isoAt(122),
        location: 'Google Meet: meet.google.com/crs-due-pv1',
        cap: 6,
        reserved: 0,
      },
      {
        id: 'slot-6',
        start_at: isoAt(144),
        end_at: isoAt(146),
        location: 'Phòng B205 - Đại học Kinh tế - Đại học Đà Nẵng',
        cap: 6,
        reserved: 0,
      },
      {
        id: 'slot-demo-full-a',
        start_at: isoAt(74),
        end_at: isoAt(75),
        location: 'DEMO_FULL_A',
        cap: 6,
        reserved: 0,
      },
      {
        id: 'slot-demo-full-b',
        start_at: isoAt(76),
        end_at: isoAt(77),
        location: 'DEMO_FULL_B',
        cap: 6,
        reserved: 4,
      },
      {
        id: 'slot-demo-full-c',
        start_at: isoAt(78),
        end_at: isoAt(79),
        location: 'DEMO_FULL_C',
        cap: 6,
        reserved: 5,
      },
    ];
    const insertSlot = db.prepare(`
      INSERT INTO interview_slots (id, round_id, start_at, end_at, location_or_link, capacity, reserved_seats, interviewer_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of slots) {
      insertSlot.run(
        s.id,
        roundId,
        s.start_at,
        s.end_at,
        s.location,
        s.cap,
        s.reserved,
        JSON.stringify([board1Id, board2Id]),
        isoAt(-120),
        isoAt(-120)
      );
    }

    return roundId;
  });

  const roundId = tx();

  if (!withSampleCandidates) {
    return {
      roundId,
      seededUsers: 0,
      seededApplications: 0,
      mode: 'empty' as const,
    };
  }

  const sampleResult = seedSample17Candidates();
  return {
    roundId: sampleResult.roundId,
    seededUsers: sampleResult.seededUsers,
    seededApplications: sampleResult.seededApplications,
    mode: 'sample' as const,
  };
}
