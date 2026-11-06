import bcrypt from 'bcryptjs';
import { db, getSetting, setSetting, getSystemNow } from './database.ts';
import { DEFAULT_TEMPLATES, NotificationService } from '../services/notificationService.ts';
import { runAutomatedCheckAndScreenPipeline, writeAuditLog } from '../services/stateMachine.ts';

export function seedDatabase(
  forceReset: boolean = false,
  withSampleCandidates: boolean = false
): {
  roundId: string;
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
    const savedT0 = getSetting('qa_slots_t0_iso', '');
    if (!savedT0) {
      const cleanupTx = db.transaction(() => {
        // Ensure interview slots stay scheduled in the future relative to getSystemNow()
        const futureSlots = [
          { id: 'slot-1', start_at: isoAt(12), end_at: isoAt(14) },
          { id: 'slot-2', start_at: isoAt(24), end_at: isoAt(26) },
          { id: 'slot-3', start_at: isoAt(36), end_at: isoAt(38) },
          { id: 'slot-4', start_at: isoAt(48), end_at: isoAt(50) },
          { id: 'slot-5', start_at: isoAt(60), end_at: isoAt(62) },
          { id: 'slot-6', start_at: isoAt(72), end_at: isoAt(74) },
        ];
        const updateSlot = db.prepare('UPDATE interview_slots SET start_at = ?, end_at = ? WHERE id = ?');
        for (const s of futureSlots) {
          updateSlot.run(s.start_at, s.end_at, s.id);
        }
      });
      cleanupTx();
    }

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

    insertUser.run(adminId, 'admin@cres.due.udn.vn', passwordHash, 'Trần Minh Quân (Quản trị viên)', 'admin', isoAt(-240), isoAt(-240));
    insertUser.run(hrId, 'hr@cres.due.udn.vn', passwordHash, 'Lê Hoàng Bảo Trân (Trưởng Ban Nhân sự)', 'hr', isoAt(-240), isoAt(-240));
    insertUser.run(board1Id, 'bcn@cres.due.udn.vn', passwordHash, 'Nguyễn Đức Thịnh (Chủ nhiệm CLB)', 'board', isoAt(-240), isoAt(-240));
    insertUser.run(board2Id, 'pho.bcn@cres.due.udn.vn', passwordHash, 'Phạm Ngọc Khánh Linh (Phó Chủ nhiệm)', 'board', isoAt(-240), isoAt(-240));
    insertUser.run('user-cand-default', 'ungvien@due.udn.vn', passwordHash, 'Nguyễn Văn Ứng Viên', 'candidate', isoAt(-240), isoAt(-240));

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
        description: 'Quản trị fanpage, sáng tạo nội dung, thiết kế ấn phẩm và truyền thông các hoạt động của Câu lạc bộ Thương mại C-RES.',
      },
      {
        id: 'dept-hr',
        name: 'Ban Nhân sự',
        quota: 7,
        description: 'Tuyển dụng, đào tạo, gắn kết thành viên và điều phối công tác tổ chức nội bộ của Câu lạc bộ Thương mại C-RES.',
      },
      {
        id: 'dept-business',
        name: 'Ban Kinh doanh',
        quota: 7,
        description: 'Lập kế hoạch thương mại, kết nối đối tác doanh nghiệp và vận hành dự án thực tế của Câu lạc bộ Thương mại C-RES.',
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

    // 5. Create 6 Future Interview Slots ready for candidate booking (+1 day to +6 days)
    const slots = [
      { id: 'slot-1', start_at: isoAt(24), end_at: isoAt(26), location: 'Phòng B203 - Đại học Kinh tế - Đại học Đà Nẵng', cap: 6 },
      { id: 'slot-2', start_at: isoAt(48), end_at: isoAt(50), location: 'Phòng B203 - Đại học Kinh tế - Đại học Đà Nẵng', cap: 6 },
      { id: 'slot-3', start_at: isoAt(72), end_at: isoAt(74), location: 'Phòng C302 - Đại học Kinh tế - Đại học Đà Nẵng', cap: 6 },
      { id: 'slot-4', start_at: isoAt(96), end_at: isoAt(98), location: 'Phòng H101 - Đại học Kinh tế - Đại học Đà Nẵng', cap: 6 },
      { id: 'slot-5', start_at: isoAt(120), end_at: isoAt(122), location: 'Google Meet: meet.google.com/crs-due-pv1', cap: 6 },
      { id: 'slot-6', start_at: isoAt(144), end_at: isoAt(146), location: 'Phòng B205 - Đại học Kinh tế - Đại học Đà Nẵng', cap: 6 },
    ];
    const insertSlot = db.prepare(`
      INSERT INTO interview_slots (id, round_id, start_at, end_at, location_or_link, capacity, interviewer_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of slots) {
      insertSlot.run(
        s.id,
        roundId,
        s.start_at,
        s.end_at,
        s.location,
        s.cap,
        JSON.stringify([board1Id, board2Id]),
        isoAt(-120),
        isoAt(-120)
      );
    }

    if (!withSampleCandidates) {
      return {
        roundId,
        seededApplications: 0,
        mode: 'empty' as const,
      };
    }

    // 6. Optional Sample Candidates (when mode === 'sample' is explicitly requested)
    const sampleCases = [
      {
        userId: 'user-sample-01',
        appId: 'app-sample-01',
        email: 'ungvien1@due.udn.vn',
        fullName: 'Nguyễn Minh Anh',
        studentId: '231121521101',
        className: '49K01.1',
        phone: '0905111201',
        dept1: 'dept-media',
        dept2: 'dept-hr',
        exp: 'Từng làm CTV truyền thông khoa Thương mại điện tử, thiết kế Canva, Photoshop, biên tập nội dung fanpage và hỗ trợ tổ chức sự kiện.',
        essay: 'Em mong muốn rèn luyện kỹ năng truyền thông thương mại và gắn bó lâu dài với Câu lạc bộ Thương mại C-RES.',
        cv: 'https://drive.google.com/file/d/cres-cv-01',
        status: 'invited_to_book',
        score: 89,
        branch: 'clear_pass',
        near: 0,
      },
      {
        userId: 'user-sample-02',
        appId: 'app-sample-02',
        email: 'ungvien2@due.udn.vn',
        fullName: 'Trần Quốc Bảo',
        studentId: '231121521102',
        className: '49K02.2',
        phone: '',
        dept1: 'dept-business',
        dept2: 'dept-media',
        exp: 'Tham gia đội tình nguyện mùa hè xanh và hỗ trợ hậu cần sự kiện sinh viên.',
        essay: 'Em muốn học hỏi kỹ năng đối ngoại doanh nghiệp tại C-RES.',
        cv: '',
        status: 'needs_supplement',
        score: null,
        branch: null,
        near: 0,
      },
      {
        userId: 'user-sample-03',
        appId: 'app-sample-03',
        email: 'ungvien3@due.udn.vn',
        fullName: 'Lê Thảo Nguyên',
        studentId: '231121521103',
        className: '49K05.1',
        phone: '0905111203',
        dept1: 'dept-hr',
        dept2: 'dept-media',
        exp: 'Đã từng tham gia điều phối nhóm bài tập lớn tại lớp và hỗ trợ công tác đoàn hội.',
        essay: 'Em yêu thích công tác nhân sự, gắn kết thành viên và xây dựng văn hóa CLB.',
        cv: '',
        status: 'needs_review',
        score: 64,
        branch: 'needs_review',
        near: 0,
      },
      {
        userId: 'user-sample-04',
        appId: 'app-sample-04',
        email: 'ungvien4@due.udn.vn',
        fullName: 'Phạm Gia Huy',
        studentId: '231121521104',
        className: '49K08.1',
        phone: '0905111204',
        dept1: 'dept-business',
        dept2: '',
        exp: 'Em mới vào năm nhất chưa có nhiều kinh nghiệm.',
        essay: 'Em rất nhiệt tình và sẵn sàng học hỏi từ các anh chị đi trước.',
        cv: '',
        status: 'clear_fail',
        score: 45,
        branch: 'clear_fail',
        near: 1,
      },
      {
        userId: 'user-sample-05',
        appId: 'app-sample-05',
        email: 'ungvien5@due.udn.vn',
        fullName: 'Võ Hoàng Yến',
        studentId: '231121521105',
        className: '49K01.2',
        phone: '0905111205',
        dept1: 'dept-media',
        dept2: 'dept-business',
        exp: 'Thành viên CLB truyền thông cấp trường THPT, quay dựng CapCut, thiết kế poster sự kiện và viết bài PR.',
        essay: 'Em cam kết dành tối thiểu 8 giờ/tuần đồng hành cùng các dự án của C-RES.',
        cv: 'https://behance.net/vohoangyen',
        status: 'scored',
        score: 92,
        branch: 'clear_pass',
        near: 0,
      },
      {
        userId: 'user-sample-06',
        appId: 'app-sample-06',
        email: 'ungvien6@due.udn.vn',
        fullName: 'Đặng Khánh Duy',
        studentId: '231121521106',
        className: '49K03.1',
        phone: '0905111206',
        dept1: 'dept-business',
        dept2: 'dept-hr',
        exp: 'Kinh nghiệm bán hàng gây quỹ CLB, thuyết trình dự án khởi nghiệp sinh viên và làm việc nhóm tốt.',
        essay: 'Em muốn phát triển kỹ năng thương mại thực chiến tại Ban Kinh doanh C-RES.',
        cv: 'https://drive.google.com/file/d/cres-cv-06',
        status: 'confirmed_joined',
        score: 90,
        branch: 'clear_pass',
        near: 0,
      },
    ];

    const insertApp = db.prepare(`
      INSERT INTO applications (
        id, round_id, user_id, full_name, student_id, class_name, email, phone,
        first_choice_dept_id, second_choice_dept_id, experience, essay, cv_url,
        commitment_confirmed, is_active_student, status, supplement_count,
        supplement_deadline_at, schedule_link_sent_at, schedule_deadline_at,
        screening_score, screening_result, is_near_threshold, submitted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of sampleCases) {
      insertUser.run(c.userId, c.email, passwordHash, c.fullName, 'candidate', isoAt(-24), isoAt(-2));
      insertApp.run(
        c.appId,
        roundId,
        c.userId,
        c.fullName,
        c.studentId,
        c.className,
        c.email,
        c.phone,
        c.dept1,
        c.dept2 || null,
        c.exp,
        c.essay,
        c.cv,
        c.status,
        c.status === 'needs_supplement' ? isoAt(48) : null,
        c.status === 'invited_to_book' ? isoAt(-2) : null,
        c.status === 'invited_to_book' ? isoAt(46) : null,
        c.score,
        c.branch,
        c.near,
        isoAt(-12),
        isoAt(-12),
        isoAt(-1)
      );
    }

    // Add missing field record for sample 2
    db.prepare(`
      INSERT INTO application_missing_fields (id, application_id, field_name, round_no, created_at, updated_at)
      VALUES ('mf-sample-02', 'app-sample-02', 'phone', 1, ?, ?)
    `).run(isoAt(-10), isoAt(-10));

    // Add booking + check-in + scorecard for sample 5 (scored) and sample 6 (confirmed_joined)
    db.prepare(`
      INSERT INTO interview_bookings (id, application_id, slot_id, booked_at, checked_in_at, no_show, created_at, updated_at)
      VALUES ('bk-sample-05', 'app-sample-05', 'slot-1', ?, ?, 0, ?, ?)
    `).run(isoAt(-6), isoAt(-3), isoAt(-6), isoAt(-3));

    db.prepare(`
      INSERT INTO scorecards (id, application_id, interviewer_id, scores, comment, submitted_at, created_at, updated_at)
      VALUES ('sc-sample-05', 'app-sample-05', ?, ?, 'Ứng viên tự tin, kỹ năng thiết kế và truyền thông tốt.', ?, ?, ?)
    `).run(
      board1Id,
      JSON.stringify({
        'crit-attitude': 9,
        'crit-skill': 8.5,
        'crit-problem': 8.5,
        'crit-teamwork': 9,
        'crit-culture': 9,
      }),
      isoAt(-2),
      isoAt(-2),
      isoAt(-2)
    );

    db.prepare(`
      INSERT INTO interview_bookings (id, application_id, slot_id, booked_at, checked_in_at, no_show, created_at, updated_at)
      VALUES ('bk-sample-06', 'app-sample-06', 'slot-1', ?, ?, 0, ?, ?)
    `).run(isoAt(-8), isoAt(-5), isoAt(-8), isoAt(-5));

    db.prepare(`
      INSERT INTO scorecards (id, application_id, interviewer_id, scores, comment, submitted_at, created_at, updated_at)
      VALUES ('sc-sample-06', 'app-sample-06', ?, ?, 'Ứng viên có tư duy kinh doanh và đối ngoại nổi bật.', ?, ?, ?)
    `).run(
      board1Id,
      JSON.stringify({
        'crit-attitude': 9.5,
        'crit-skill': 9,
        'crit-problem': 9,
        'crit-teamwork': 8.5,
        'crit-culture': 9,
      }),
      isoAt(-4),
      isoAt(-4),
      isoAt(-4)
    );

    db.prepare(`
      INSERT INTO selection_decisions (id, application_id, total_score, decision, decided_by, note, notified_at, created_at, updated_at)
      VALUES ('sd-sample-06', 'app-sample-06', 90.5, 'pass', ?, 'Đậu phỏng vấn xuất sắc', ?, ?, ?)
    `).run(board1Id, isoAt(-3), isoAt(-3), isoAt(-3));

    return {
      roundId,
      seededApplications: sampleCases.length,
      mode: 'sample' as const,
    };
  });

  return tx();
}

const KINH_NGHIEM_A =
  'Em đã tham gia CLB và hỗ trợ tổ chức sự kiện sinh viên. Em từng viết nội dung truyền thông, thiết kế ấn phẩm, phối hợp hậu cần và làm việc nhóm. Em có thể hỗ trợ hoạt động tình nguyện, kết nối tài trợ và theo dõi tiến độ công việc.';
const KINH_NGHIEM_B = 'Em có kinh nghiệm làm việc nhóm và sẵn sàng học hỏi.';
const KINH_NGHIEM_C = 'Mới';
const KINH_NGHIEM_D = 'clb';
const TU_LUAN_CHUNG =
  'Em muốn tham gia C-RES để rèn kỹ năng làm việc nhóm và đóng góp cho hoạt động sinh viên. Em cam kết tham gia các buổi họp, hoàn thành nhiệm vụ được giao và trao đổi sớm khi có khó khăn.';

export interface QaCandidateSeedItem {
  code: string;
  userId: string;
  appId: string;
  full_name: string;
  email: string;
  student_id: string;
  phone: string;
  first_choice_dept_id: string;
  second_choice_dept_id: string;
  experience: string;
  essay: string;
  cv_url: string;
}

export const QA_17_CANDIDATES: QaCandidateSeedItem[] = [
  {
    code: 'C01',
    userId: 'user-qa-c01',
    appId: 'app-qa-c01',
    full_name: 'TEST 01 Minh An',
    email: 'qa.cres.01@example.com',
    student_id: '990000000001',
    phone: '0900000101',
    first_choice_dept_id: 'dept-media',
    second_choice_dept_id: 'dept-hr',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c01',
  },
  {
    code: 'C02',
    userId: 'user-qa-c02',
    appId: 'app-qa-c02',
    full_name: 'TEST 02 Bao Binh',
    email: 'qa.cres.02@example.com',
    student_id: '990000000002',
    phone: '',
    first_choice_dept_id: 'dept-hr',
    second_choice_dept_id: 'dept-business',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c02',
  },
  {
    code: 'C03',
    userId: 'user-qa-c03',
    appId: 'app-qa-c03',
    full_name: 'TEST 03 Gia Chi',
    email: 'qa.cres.03@example.com',
    student_id: '990000000003',
    phone: '0900000103',
    first_choice_dept_id: 'dept-business',
    second_choice_dept_id: 'dept-hr',
    experience: KINH_NGHIEM_A,
    essay: '',
    cv_url: 'https://example.com/cres-demo/cv-c03',
  },
  {
    code: 'C04',
    userId: 'user-qa-c04',
    appId: 'app-qa-c04',
    full_name: 'TEST 04 Hoai Duong',
    email: 'qa.cres.04@example.com',
    student_id: '990000000004',
    phone: '',
    first_choice_dept_id: 'dept-hr',
    second_choice_dept_id: 'dept-media',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c04',
  },
  {
    code: 'C05',
    userId: 'user-qa-c05',
    appId: 'app-qa-c05',
    full_name: 'TEST 05 Khanh Ha',
    email: 'qa.cres.05@example.com',
    student_id: '990000000005',
    phone: '0900000105',
    first_choice_dept_id: 'dept-business',
    second_choice_dept_id: 'dept-hr',
    experience: KINH_NGHIEM_B,
    essay: TU_LUAN_CHUNG,
    cv_url: '',
  },
  {
    code: 'C06',
    userId: 'user-qa-c06',
    appId: 'app-qa-c06',
    full_name: 'TEST 06 Ngoc Hieu',
    email: 'qa.cres.06@example.com',
    student_id: '990000000006',
    phone: '0900000106',
    first_choice_dept_id: 'dept-hr',
    second_choice_dept_id: 'dept-business',
    experience: KINH_NGHIEM_B,
    essay: TU_LUAN_CHUNG,
    cv_url: '',
  },
  {
    code: 'C07',
    userId: 'user-qa-c07',
    appId: 'app-qa-c07',
    full_name: 'TEST 07 Quynh Khang',
    email: 'qa.cres.07@example.com',
    student_id: '990000000007',
    phone: '0900000107',
    first_choice_dept_id: 'dept-business',
    second_choice_dept_id: '',
    experience: KINH_NGHIEM_C,
    essay: TU_LUAN_CHUNG,
    cv_url: '',
  },
  {
    code: 'C08',
    userId: 'user-qa-c08',
    appId: 'app-qa-c08',
    full_name: 'TEST 08 Thanh Lam',
    email: 'qa.cres.08@example.com',
    student_id: '990000000008',
    phone: '0900000108',
    first_choice_dept_id: 'dept-media',
    second_choice_dept_id: '',
    experience: KINH_NGHIEM_D,
    essay: TU_LUAN_CHUNG,
    cv_url: '',
  },
  {
    code: 'C09',
    userId: 'user-qa-c09',
    appId: 'app-qa-c09',
    full_name: 'TEST 09 Nhat Minh',
    email: 'qa.cres.09@example.com',
    student_id: '990000000009',
    phone: '0900000109',
    first_choice_dept_id: 'dept-business',
    second_choice_dept_id: 'dept-hr',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c09',
  },
  {
    code: 'C10',
    userId: 'user-qa-c10',
    appId: 'app-qa-c10',
    full_name: 'TEST 10 Thao Nhi',
    email: 'qa.cres.10@example.com',
    student_id: '990000000010',
    phone: '0900000110',
    first_choice_dept_id: 'dept-hr',
    second_choice_dept_id: 'dept-media',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c10',
  },
  {
    code: 'C11',
    userId: 'user-qa-c11',
    appId: 'app-qa-c11',
    full_name: 'TEST 11 Viet Phuc',
    email: 'qa.cres.11@example.com',
    student_id: '990000000011',
    phone: '0900000111',
    first_choice_dept_id: 'dept-media',
    second_choice_dept_id: 'dept-hr',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c11',
  },
  {
    code: 'C12',
    userId: 'user-qa-c12',
    appId: 'app-qa-c12',
    full_name: 'TEST 12 Mai Quynh',
    email: 'qa.cres.12@example.com',
    student_id: '990000000012',
    phone: '0900000112',
    first_choice_dept_id: 'dept-media',
    second_choice_dept_id: 'dept-business',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c12',
  },
  {
    code: 'C13',
    userId: 'user-qa-c13',
    appId: 'app-qa-c13',
    full_name: 'TEST 13 Duc Son',
    email: 'qa.cres.13@example.com',
    student_id: '990000000013',
    phone: '0900000113',
    first_choice_dept_id: 'dept-business',
    second_choice_dept_id: 'dept-hr',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c13',
  },
  {
    code: 'C14',
    userId: 'user-qa-c14',
    appId: 'app-qa-c14',
    full_name: 'TEST 14 Thu Trang',
    email: 'qa.cres.14@example.com',
    student_id: '990000000014',
    phone: '0900000114',
    first_choice_dept_id: 'dept-hr',
    second_choice_dept_id: 'dept-business',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c14',
  },
  {
    code: 'C15',
    userId: 'user-qa-c15',
    appId: 'app-qa-c15',
    full_name: 'TEST 15 Hai Uyen',
    email: 'qa.cres.15@example.com',
    student_id: '990000000015',
    phone: '0900000115',
    first_choice_dept_id: 'dept-business',
    second_choice_dept_id: 'dept-hr',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c15',
  },
  {
    code: 'C16',
    userId: 'user-qa-c16',
    appId: 'app-qa-c16',
    full_name: 'TEST 16 Tuan Vy',
    email: 'qa.cres.16@example.com',
    student_id: '990000000016',
    phone: '0900000116',
    first_choice_dept_id: 'dept-media',
    second_choice_dept_id: 'dept-business',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c16',
  },
  {
    code: 'C17',
    userId: 'user-qa-c17',
    appId: 'app-qa-c17',
    full_name: 'TEST 17 Yen Xuan',
    email: 'qa.cres.17@example.com',
    student_id: '990000000017',
    phone: '0900000117',
    first_choice_dept_id: 'dept-business',
    second_choice_dept_id: 'dept-hr',
    experience: KINH_NGHIEM_A,
    essay: TU_LUAN_CHUNG,
    cv_url: 'https://example.com/cres-demo/cv-c17',
  },
];

export interface Qa17SeedResultItem {
  code: string;
  email: string;
  userOutcome: 'created' | 'existed';
  appOutcome: 'created' | 'existed';
  status: string;
  screening_score: number | null;
}

export function ensureQa17CandidatesSeeded(): {
  createdUsers: number;
  existingUsers: number;
  createdApplications: number;
  existingApplications: number;
  items: Qa17SeedResultItem[];
} {
  const round = db
    .prepare('SELECT id FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
    .get() as { id: string } | undefined;

  if (!round) {
    return {
      createdUsers: 0,
      existingUsers: 0,
      createdApplications: 0,
      existingApplications: 0,
      items: [],
    };
  }

  const passwordHash = bcrypt.hashSync('CresDemo2026!', 8);
  const baseNow = getSystemNow();

  const findUserByEmail = db.prepare('SELECT id, email FROM users WHERE email = ?');
  const findAppByEmailOrUser = db.prepare(
    'SELECT id, status, screening_score FROM applications WHERE email = ? OR user_id = ? LIMIT 1'
  );
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
      ?, ?, ?, ?, ?, '50K14.2', ?, ?,
      ?, ?, ?, ?, ?,
      1, 1,
      'submitted', 0, ?, ?, ?
    )
  `);

  let createdUsers = 0;
  let existingUsers = 0;
  let createdApplications = 0;
  let existingApplications = 0;
  const items: Qa17SeedResultItem[] = [];

  for (let i = 0; i < QA_17_CANDIDATES.length; i++) {
    const c = QA_17_CANDIDATES[i];
    // Stagger timestamps by 1 second so C01 is newest and C17 is oldest in default DESC sorting
    const itemIso = new Date(baseNow.getTime() - i * 1000).toISOString();

    let existingUser = findUserByEmail.get(c.email) as { id: string; email: string } | undefined;
    let userOutcome: 'created' | 'existed' = 'existed';
    let targetUserId = existingUser?.id || c.userId;

    if (!existingUser) {
      insertUser.run(targetUserId, c.email, passwordHash, c.full_name, itemIso, itemIso);
      createdUsers += 1;
      userOutcome = 'created';
    } else {
      existingUsers += 1;
    }

    const existingApp = findAppByEmailOrUser.get(c.email, targetUserId) as
      | { id: string; status: string; screening_score: number | null }
      | undefined;

    if (existingApp) {
      existingApplications += 1;
      items.push({
        code: c.code,
        email: c.email,
        userOutcome,
        appOutcome: 'existed',
        status: existingApp.status,
        screening_score: existingApp.screening_score,
      });
      continue;
    }

    insertApp.run(
      c.appId,
      round.id,
      targetUserId,
      c.full_name,
      String(c.student_id),
      c.email,
      String(c.phone),
      c.first_choice_dept_id,
      c.second_choice_dept_id,
      c.experience,
      c.essay,
      c.cv_url,
      itemIso,
      itemIso,
      itemIso
    );

    writeAuditLog({
      applicationId: c.appId,
      actor: `user:${targetUserId}`,
      action: 'SUBMIT_APPLICATION',
      ruleApplied: 'Candidate Form Submission -> Start Case',
      inputSnapshot: {
        full_name: c.full_name,
        student_id: String(c.student_id),
        class_name: '50K14.2',
        first_choice_dept_id: c.first_choice_dept_id,
      },
      result: 'Ứng viên đã nộp đơn đăng ký CTV.',
      createdAt: itemIso,
    });

    const processed = runAutomatedCheckAndScreenPipeline(c.appId, 'system');
    createdApplications += 1;
    items.push({
      code: c.code,
      email: c.email,
      userOutcome,
      appOutcome: 'created',
      status: processed.status,
      screening_score: processed.screening_score,
    });
  }

  return {
    createdUsers,
    existingUsers,
    createdApplications,
    existingApplications,
    items,
  };
}


