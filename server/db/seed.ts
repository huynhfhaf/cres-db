import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db, setSetting } from './database';
import { DEFAULT_TEMPLATES, NotificationService } from '../services/notificationService';
import { REQUIRED_FIELD_LABELS } from '../rules/rulesEngine';

export function seedDatabase(forceReset: boolean = false): {
  roundId: string;
  seededApplications: number;
} {
  const existingUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (existingUsers.cnt > 0 && !forceReset) {
    const round = db.prepare('SELECT id FROM recruitment_rounds LIMIT 1').get() as { id: string } | undefined;
    const appCnt = db.prepare('SELECT COUNT(*) as cnt FROM applications').get() as { cnt: number };
    return {
      roundId: round?.id || '',
      seededApplications: appCnt.cnt,
    };
  }

  const baseNow = new Date();
  const isoAt = (offsetHours: number) => new Date(baseNow.getTime() + offsetHours * 3600 * 1000).toISOString();

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

    // 1. Create Demo Users for 4 roles + additional Board members
    const adminId = 'user-admin-01';
    const hrId = 'user-hr-01';
    const board1Id = 'user-board-01';
    const board2Id = 'user-board-02';
    const demoCandidateId = 'user-cand-01';

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(adminId, 'admin@cres.due.udn.vn', passwordHash, 'Trần Minh Quân (Admin CLB)', 'admin', isoAt(-240), isoAt(-240));
    insertUser.run(hrId, 'hr@cres.due.udn.vn', passwordHash, 'Lê Hoàng Bảo Trân (Trưởng Ban Nhân sự)', 'hr', isoAt(-240), isoAt(-240));
    insertUser.run(board1Id, 'bcn@cres.due.udn.vn', passwordHash, 'Nguyễn Đức Thịnh (Chủ nhiệm CLB)', 'board', isoAt(-240), isoAt(-240));
    insertUser.run(board2Id, 'pho.bcn@cres.due.udn.vn', passwordHash, 'Phạm Ngọc Khánh Linh (Phó Chủ nhiệm)', 'board', isoAt(-240), isoAt(-240));
    insertUser.run(demoCandidateId, 'ungvien@due.udn.vn', passwordHash, 'Nguyễn Lê Thảo Vy', 'candidate', isoAt(-48), isoAt(-2));

    // 2. Create 1 Active Recruitment Round
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
      'Đợt Tuyển CTV Mùa Thu 2026',
      'Chuỗi Sự kiện Khởi nghiệp & Nghiên cứu Kinh tế C-res Forum 2026',
      isoAt(-168),
      isoAt(168),
      'https://zalo.me/g/cres-ctv-gen2026-due',
      isoAt(-168),
      isoAt(-1)
    );

    // 3. Create 4 Departments (Truyền thông, Hậu cần, Nội dung, Đối ngoại)
    const depts = [
      {
        id: 'dept-media',
        name: 'Ban Truyền thông',
        quota: 6,
        description: 'Quản trị fanpage C-res, thiết kế ấn phẩm truyền thông, chụp ảnh - dựng video sự kiện tại ĐH Kinh tế ĐHĐN.',
      },
      {
        id: 'dept-logistics',
        name: 'Ban Hậu cần',
        quota: 6,
        description: 'Chuẩn bị hội trường, âm thanh ánh sáng, điều phối check-in và hậu cần sự kiện trực tiếp tại DUE.',
      },
      {
        id: 'dept-content',
        name: 'Ban Nội dung',
        quota: 5,
        description: 'Xây dựng kịch bản chương trình, biên tập đề tài học thuật - kinh tế, điều phối diễn giả & khách mời chuyên môn.',
      },
      {
        id: 'dept-er',
        name: 'Ban Đối ngoại',
        quota: 5,
        description: 'Mời tài trợ doanh nghiệp tại Đà Nẵng, chăm sóc đối tác, truyền thông quan hệ công chúng & báo chí.',
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
      { id: 'crit-attitude', name: 'Thái độ & Mức độ cam kết thời gian', weight: 25, max_score: 10 },
      { id: 'crit-skill', name: 'Kỹ năng chuyên môn theo Ban nguyện vọng', weight: 25, max_score: 10 },
      { id: 'crit-problem', name: 'Tư duy xử lý tình huống sự kiện', weight: 20, max_score: 10 },
      { id: 'crit-teamwork', name: 'Kỹ năng giao tiếp & Phối hợp nhóm', weight: 15, max_score: 10 },
      { id: 'crit-culture', name: 'Sự phù hợp văn hóa CLB C-res DUE', weight: 15, max_score: 10 },
    ];
    const insertCrit = db.prepare(`
      INSERT INTO scoring_criteria (id, round_id, name, weight, max_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of criteria) {
      insertCrit.run(c.id, roundId, c.name, c.weight, c.max_score, isoAt(-168), isoAt(-168));
    }

    // 5. Create 8 Interview Slots
    const slots = [
      { id: 'slot-1', start_at: isoAt(-48), end_at: isoAt(-46), location: 'Phòng B203 - ĐH Kinh tế ĐHĐN', cap: 6 },
      { id: 'slot-2', start_at: isoAt(-36), end_at: isoAt(-34), location: 'Phòng B203 - ĐH Kinh tế ĐHĐN', cap: 6 },
      { id: 'slot-3', start_at: isoAt(-24), end_at: isoAt(-22), location: 'Phòng C302 - ĐH Kinh tế ĐHĐN', cap: 6 },
      { id: 'slot-4', start_at: isoAt(-12), end_at: isoAt(-10), location: 'Phòng C302 - ĐH Kinh tế ĐHĐN', cap: 6 },
      { id: 'slot-5', start_at: isoAt(12), end_at: isoAt(14), location: 'Phòng H101 - ĐH Kinh tế ĐHĐN', cap: 5 },
      { id: 'slot-6', start_at: isoAt(24), end_at: isoAt(26), location: 'Phòng H101 - ĐH Kinh tế ĐHĐN', cap: 5 },
      { id: 'slot-7', start_at: isoAt(36), end_at: isoAt(38), location: 'Google Meet: meet.google.com/crs-due-pv1', cap: 6 },
      { id: 'slot-8', start_at: isoAt(48), end_at: isoAt(50), location: 'Phòng B205 - ĐH Kinh tế ĐHĐN', cap: 6 },
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

    // 6. Create 42 Candidate Applications across all workflow states
    interface SeedAppSpec {
      id: string;
      userId?: string;
      name: string;
      sid: string;
      cls: string;
      email: string;
      phone: string;
      d1: string;
      d2: string;
      exp: string;
      essay: string;
      cv: string;
      status: string;
      suppCount?: number;
      suppDeadlineHours?: number | null;
      missingFields?: string[];
      schedSentHours?: number | null;
      schedRemindedHours?: number | null;
      schedDeadlineHours?: number | null;
      screenScore: number | null;
      screenResult: string | null;
      nearThreshold?: number;
      endReason?: string | null;
      withdrawReason?: string | null;
      subHours: number;
      finHours?: number | null;
      slotId?: string;
      checkedInHours?: number | null;
      scorecardScores?: Array<{ interviewerId: string; scores: Record<string, number>; comment: string }>;
      selectionDecision?: { totalScore: number; decision: 'pass' | 'waitlist' | 'fail'; note: string; notified?: boolean };
      assignmentSpec?: { deptId: string; aiDeptId: string; aiReason: string; status: 'suggested' | 'confirmed' | 'revoked' };
      reviewSpec?: { decision: 'pass' | 'fail'; reason: string };
    }

    const specs: SeedAppSpec[] = [
      // Demo Candidate #1: Invited to book interview (so when user logs in as demo candidate, they can test booking, checking in, or withdrawing right away!)
      {
        id: 'app-01',
        userId: demoCandidateId,
        name: 'Nguyễn Lê Thảo Vy',
        sid: '221121521101',
        cls: '48K01.1',
        email: 'ungvien@due.udn.vn',
        phone: '0905112233',
        d1: 'dept-media',
        d2: 'dept-content',
        exp: 'Thành viên đội truyền thông Khoa Marketing DUE, thiết kế Canva/Photoshop và chụp ảnh sự kiện chào tân sinh viên 49K.',
        essay: 'Em mong muốn gia nhập CLB C-res để rèn luyện kỹ năng tổ chức sự kiện học thuật chuyên nghiệp và lan tỏa hình ảnh năng động của sinh viên DUE.',
        cv: 'https://behance.net/thaovy-due',
        status: 'invited_to_book',
        schedSentHours: -10,
        schedDeadlineHours: 38,
        screenScore: 88,
        screenResult: 'clear_pass',
        subHours: -36,
      },
      // 2-4: Needs supplement (3 cases: 2 active within deadline, 1 near deadline so +2 days time travel expires them!)
      {
        id: 'app-02',
        name: 'Trần Quốc Bảo',
        sid: '221121521102',
        cls: '48K02.1',
        email: 'quocbao@due.udn.vn',
        phone: '',
        d1: 'dept-logistics',
        d2: 'dept-er',
        exp: 'Từng tham gia hỗ trợ hậu cần Hội sách mùa thu tại Đà Nẵng.',
        essay: '',
        cv: '',
        status: 'needs_supplement',
        suppCount: 1,
        suppDeadlineHours: 20, // expires when +1 or +2 days clicked
        missingFields: ['phone', 'essay'],
        screenScore: null,
        screenResult: null,
        subHours: -28,
      },
      {
        id: 'app-03',
        name: 'Lê Thị Minh Châu',
        sid: '231121521103',
        cls: '49K05.2',
        email: 'minhchau@due.udn.vn',
        phone: '0914223344',
        d1: 'dept-content',
        d2: 'dept-media',
        exp: '',
        essay: 'Em yêu thích nghiên cứu kinh tế và viết lách.',
        cv: '',
        status: 'needs_supplement',
        suppCount: 1,
        suppDeadlineHours: 36, // expires when +2 days clicked
        missingFields: ['experience'],
        screenScore: null,
        screenResult: null,
        subHours: -12,
      },
      // 4-5: Already expired_supplement (END #1: Bị loại vì quá hạn)
      {
        id: 'app-04',
        name: 'Phạm Hoàng Nam',
        sid: '231121521104',
        cls: '49K14.1',
        email: 'hoangnam@due.udn.vn',
        phone: '',
        d1: 'dept-logistics',
        d2: '',
        exp: '',
        essay: 'Em muốn thử sức ở CLB.',
        cv: '',
        status: 'expired_supplement',
        suppCount: 1,
        missingFields: ['phone', 'experience'],
        screenScore: null,
        screenResult: null,
        endReason: 'expired_supplement',
        subHours: -96,
        finHours: -48,
      },
      {
        id: 'app-05',
        name: 'Võ Đình Khôi',
        sid: '221121521105',
        cls: '48K06.1',
        email: 'dinhkhoi@due.udn.vn',
        phone: '0935111222',
        d1: 'dept-er',
        d2: 'dept-logistics',
        exp: '',
        essay: '',
        cv: '',
        status: 'expired_supplement',
        suppCount: 2,
        missingFields: ['experience', 'essay'],
        screenScore: null,
        screenResult: null,
        endReason: 'expired_supplement',
        subHours: -110,
        finHours: -62,
      },
      // 6-9: Needs manual HR review ('needs_review', score between Y=50 and X=75)
      {
        id: 'app-06',
        name: 'Đặng Ngọc Ánh',
        sid: '221121521106',
        cls: '48K08.2',
        email: 'ngocanh@due.udn.vn',
        phone: '0905234567',
        d1: 'dept-content',
        d2: 'dept-media',
        exp: 'Tham gia viết bài cho tập san lớp 48K08.2 và hỗ trợ truyền thông giải bóng đá khoa.',
        essay: 'Em có khả năng tổng hợp tài liệu kinh tế vĩ mô, viết kịch bản MC chi tiết và luôn đúng hạn trong mọi deadline của nhóm.',
        cv: '',
        status: 'needs_review',
        screenScore: 65,
        screenResult: 'needs_review',
        subHours: -20,
      },
      {
        id: 'app-07',
        name: 'Hoàng Gia Huy',
        sid: '231121521107',
        cls: '49K01.3',
        email: 'giahuy@due.udn.vn',
        phone: '0988345678',
        d1: 'dept-er',
        d2: 'dept-logistics',
        exp: 'Từng làm tình nguyện viên tiếp đón khách mời tại hội thảo hướng nghiệp DUE.',
        essay: 'Em tự tin vào khả năng giao tiếp, thuyết phục nhà tài trợ và mong muốn học hỏi quy trình đối ngoại chuyên nghiệp tại C-res.',
        cv: '',
        status: 'needs_review',
        screenScore: 62,
        screenResult: 'needs_review',
        subHours: -18,
      },
      {
        id: 'app-08',
        name: 'Bùi Thanh Trúc',
        sid: '231121521108',
        cls: '49K12.1',
        email: 'thanhtruc@due.udn.vn',
        phone: '0977456789',
        d1: 'dept-media',
        d2: 'dept-content',
        exp: 'Biết quay dựng CapCut và chỉnh ảnh Lightroom cơ bản cho các hoạt động đoàn hội.',
        essay: 'Em rất ấn tượng với chuỗi sự kiện học thuật của C-res và muốn đóng góp góc nhìn trẻ trung qua các thước phim recap.',
        cv: '',
        status: 'needs_review',
        screenScore: 68,
        screenResult: 'needs_review',
        subHours: -15,
      },
      // 9-10: Clear fail NEAR threshold (45 <= score < 50) -> waiting in HR queue "Loại rõ gần ngưỡng – xem lại trước khi gửi"
      {
        id: 'app-09',
        name: 'Ngô Minh Tuấn',
        sid: '231121521109',
        cls: '49K21.2',
        email: 'minhtuan@due.udn.vn',
        phone: '0905678901',
        d1: 'dept-logistics',
        d2: '',
        exp: 'Mới vào năm nhất, chưa tham gia CLB nào.',
        essay: 'Em muốn tìm môi trường năng động để giao lưu cùng các anh chị khóa trên.',
        cv: '',
        status: 'clear_fail',
        screenScore: 47,
        screenResult: 'clear_fail',
        nearThreshold: 1,
        subHours: -22,
      },
      {
        id: 'app-10',
        name: 'Trịnh Bảo Ngọc',
        sid: '231121521110',
        cls: '49K03.1',
        email: 'baongoc@due.udn.vn',
        phone: '0905678902',
        d1: 'dept-content',
        d2: 'dept-er',
        exp: 'Chưa có kinh nghiệm tổ chức sự kiện.',
        essay: 'Em muốn học thêm kỹ năng mềm.',
        cv: '',
        status: 'clear_fail',
        screenScore: 46,
        screenResult: 'clear_fail',
        nearThreshold: 1,
        subHours: -19,
      },
      // 11-14: Rejected docs (END #2: Hồ sơ không đạt - both auto clear_fail and manual review_fail)
      {
        id: 'app-11',
        name: 'Phan Văn Kiên',
        sid: '231121521111',
        cls: '49K09.1',
        email: 'vankien@due.udn.vn',
        phone: '0905000111',
        d1: 'dept-logistics',
        d2: '',
        exp: 'Chưa có.',
        essay: 'Đăng ký thử.',
        cv: '',
        status: 'rejected_docs',
        screenScore: 38,
        screenResult: 'clear_fail',
        nearThreshold: 0,
        endReason: 'rejected_docs',
        subHours: -80,
        finHours: -79,
      },
      {
        id: 'app-12',
        name: 'Lý Hoàng Yến',
        sid: '221121521112',
        cls: '48K11.2',
        email: 'hoangyen@due.udn.vn',
        phone: '0905000112',
        d1: 'dept-media',
        d2: 'dept-er',
        exp: 'Từng hỗ trợ phát tờ rơi.',
        essay: 'Em chỉ rảnh vào buổi tối chủ nhật.',
        cv: '',
        status: 'rejected_docs',
        screenScore: 55,
        screenResult: 'needs_review',
        endReason: 'rejected_docs',
        subHours: -75,
        finHours: -60,
        reviewSpec: { decision: 'fail', reason: 'Quỹ thời gian cá nhân quá hạn hẹp, chưa đáp ứng lịch chạy sự kiện thực tế của Ban Truyền thông.' },
      },
      {
        id: 'app-13',
        name: 'Đỗ Quang Vinh',
        sid: '231121521113',
        cls: '49K15.1',
        email: 'quangvinh@due.udn.vn',
        phone: '0905000113',
        d1: 'dept-er',
        d2: '',
        exp: 'Không có.',
        essay: 'Em muốn tham gia.',
        cv: '',
        status: 'rejected_docs',
        screenScore: 40,
        screenResult: 'clear_fail',
        endReason: 'rejected_docs',
        subHours: -72,
        finHours: -71,
      },
      {
        id: 'app-14',
        name: 'Hồ Thị Thu Hà',
        sid: '221121521114',
        cls: '48K04.1',
        email: 'thuha@due.udn.vn',
        phone: '0905000114',
        d1: 'dept-content',
        d2: '',
        exp: 'Từng tham gia nhóm văn nghệ.',
        essay: 'Câu trả lời tự luận quá sơ sài, chưa nêu rõ định hướng nội dung.',
        cv: '',
        status: 'rejected_docs',
        screenScore: 54,
        screenResult: 'needs_review',
        endReason: 'rejected_docs',
        subHours: -68,
        finHours: -52,
        reviewSpec: { decision: 'fail', reason: 'Phần tự luận chưa thể hiện sự tìm hiểu về mảng học thuật của CLB C-res.' },
      },
      // 15-16: Invited to book (waiting to book, 1 already reminded, 1 ready to remind on +1 day)
      {
        id: 'app-15',
        name: 'Vũ Minh Khang',
        sid: '221121521115',
        cls: '48K07.1',
        email: 'minhkhang@due.udn.vn',
        phone: '0905000115',
        d1: 'dept-logistics',
        d2: 'dept-er',
        exp: 'Thành viên đội thanh niên xung kích khoa Quản trị Kinh doanh DUE, có kinh nghiệm điều phối hội trường 500 khách.',
        essay: 'Em muốn đồng hành cùng Ban Hậu cần tạo nên sự kiện C-res Forum chỉn chu nhất.',
        cv: 'https://linkedin.com/in/minhkhang-due',
        status: 'invited_to_book',
        schedSentHours: -18, // +1 day will trigger 1-day reminder!
        schedDeadlineHours: 30,
        screenScore: 84,
        screenResult: 'clear_pass',
        subHours: -30,
      },
      {
        id: 'app-16',
        name: 'Dương Mỹ Linh',
        sid: '221121521116',
        cls: '48K10.2',
        email: 'mylinh@due.udn.vn',
        phone: '0905000116',
        d1: 'dept-er',
        d2: 'dept-content',
        exp: 'Trưởng nhóm đối ngoại dự án sinh viên Đà Nẵng Xanh, từng gọi tài trợ thành công 15 triệu đồng.',
        essay: 'Em yêu thích công việc kết nối doanh nghiệp với sinh viên Kinh tế.',
        cv: 'https://linkedin.com/in/mylinh-due',
        status: 'invited_to_book',
        schedSentHours: -30,
        schedRemindedHours: -6, // Already reminded once! +1 day will drop after 48h!
        schedDeadlineHours: 18,
        screenScore: 90,
        screenResult: 'clear_pass',
        subHours: -40,
      },
      // 17-19: No booking (END #3: Ứng viên không tham gia - dropped after 2 days)
      {
        id: 'app-17',
        name: 'Lương Gia Bảo',
        sid: '221121521117',
        cls: '48K16.1',
        email: 'giabao@due.udn.vn',
        phone: '0905000117',
        d1: 'dept-media',
        d2: 'dept-logistics',
        exp: 'Có kinh nghiệm chụp ảnh sự kiện và thiết kế banner CLB.',
        essay: 'Em mong muốn đóng góp cho mảng hình ảnh của CLB.',
        cv: 'https://behance.net/giabao',
        status: 'no_booking',
        schedSentHours: -96,
        schedRemindedHours: -72,
        screenScore: 82,
        screenResult: 'clear_pass',
        endReason: 'no_booking',
        subHours: -102,
        finHours: -48,
      },
      {
        id: 'app-18',
        name: 'Tạ Phương Thảo',
        sid: '231121521118',
        cls: '49K02.2',
        email: 'phuongthao@due.udn.vn',
        phone: '0905000118',
        d1: 'dept-content',
        d2: 'dept-media',
        exp: 'Biên tập viên fanpage trường THPT và tham gia CLB Sách DUE.',
        essay: 'Em muốn phát triển kỹ năng viết nội dung học thuật.',
        cv: 'https://drive.google.com/phuongthao-cv',
        status: 'no_booking',
        schedSentHours: -90,
        schedRemindedHours: -66,
        screenScore: 80,
        screenResult: 'clear_pass',
        endReason: 'no_booking',
        subHours: -95,
        finHours: -42,
      },
      // 19-21: Booked / Interviewing (Parallel AND branch in progress)
      {
        id: 'app-19',
        name: 'Nguyễn Hữu Phước',
        sid: '221121521119',
        cls: '48K03.2',
        email: 'huuphuoc@due.udn.vn',
        phone: '0905000119',
        d1: 'dept-logistics',
        d2: 'dept-media',
        exp: 'Phó bí thư chi đoàn 48K03.2, điều phối hậu cần giải chạy sinh viên Kinh tế.',
        essay: 'Em có sức khỏe tốt, tinh thần trách nhiệm cao và sẵn sàng hỗ trợ mọi khâu hậu cần.',
        cv: 'https://drive.google.com/huuphuoc-cv',
        status: 'booked',
        slotId: 'slot-5',
        screenScore: 85,
        screenResult: 'clear_pass',
        subHours: -50,
      },
      {
        id: 'app-20',
        name: 'Trần Thanh Tâm',
        sid: '221121521120',
        cls: '48K19.1',
        email: 'thanhtam@due.udn.vn',
        phone: '0905000120',
        d1: 'dept-media',
        d2: 'dept-content',
        exp: 'Thiết kế bộ nhận diện cho 3 workshop tại Khoa Tài chính - Ngân hàng DUE.',
        essay: 'Em muốn mang phong cách thiết kế hiện đại vào ấn phẩm của C-res.',
        cv: 'https://behance.net/thanhtam-due',
        status: 'interviewing',
        slotId: 'slot-4',
        checkedInHours: -11, // Checked in, waiting for BCN scorecard!
        screenScore: 90,
        screenResult: 'clear_pass',
        subHours: -55,
      },
      // 21-24: Scored (AND-join converged! Checked in + >=1 scorecard -> Ready for BCN decision in Selection Summary)
      {
        id: 'app-21',
        name: 'Lê Nguyễn Bảo Hân',
        sid: '221121521121',
        cls: '48K01.2',
        email: 'baohan@due.udn.vn',
        phone: '0905000121',
        d1: 'dept-media',
        d2: 'dept-content',
        exp: 'Quản trị kênh TikTok & Fanpage dự án sinh viên với hơn 20.000 lượt tiếp cận mỗi bài.',
        essay: 'Em đã theo dõi C-res từ năm nhất và rất tâm huyết với mảng truyền thông học thuật.',
        cv: 'https://behance.net/baohan-due',
        status: 'scored',
        slotId: 'slot-3',
        checkedInHours: -24,
        screenScore: 92,
        screenResult: 'clear_pass',
        subHours: -70,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 9.5, 'crit-skill': 9.0, 'crit-problem': 8.5, 'crit-teamwork': 9.0, 'crit-culture': 9.0 },
            comment: 'Portfolio thiết kế rất sáng tạo, thái độ lễ phép, cam kết cao.',
          },
          {
            interviewerId: board2Id,
            scores: { 'crit-attitude': 9.0, 'crit-skill': 9.0, 'crit-problem': 8.0, 'crit-teamwork': 8.5, 'crit-culture': 9.0 },
            comment: 'Nắm vững công cụ thiết kế và tư duy truyền thông tốt.',
          },
        ],
      },
      {
        id: 'app-22',
        name: 'Phạm Quốc Đạt',
        sid: '221121521122',
        cls: '48K14.2',
        email: 'quocdat@due.udn.vn',
        phone: '0905000122',
        d1: 'dept-er',
        d2: 'dept-logistics',
        exp: 'Thành viên CLB Khởi nghiệp, từng liên hệ 20 doanh nghiệp mời tài trợ hiện kim và hiện vật.',
        essay: 'Em mong muốn phát huy kỹ năng đàm phán tại Ban Đối ngoại C-res.',
        cv: 'https://linkedin.com/in/quocdat-due',
        status: 'scored',
        slotId: 'slot-3',
        checkedInHours: -24,
        screenScore: 86,
        screenResult: 'clear_pass',
        subHours: -72,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 8.5, 'crit-skill': 8.5, 'crit-problem': 8.0, 'crit-teamwork': 8.5, 'crit-culture': 8.5 },
            comment: 'Giao tiếp tự tin, xử lý tình huống từ chối tài trợ rất khéo léo.',
          },
        ],
      },
      {
        id: 'app-23',
        name: 'Hoàng Minh Thư',
        sid: '231121521123',
        cls: '49K07.1',
        email: 'minhthu@due.udn.vn',
        phone: '0905000123',
        d1: 'dept-content',
        d2: 'dept-er',
        exp: 'Giải Nhì Olympic Kinh tế học cấp Khoa, biên tập nội dung chuyên đề nghiên cứu sinh viên.',
        essay: 'Em muốn xây dựng nội dung chuyên sâu và hấp dẫn cho diễn đàn C-res.',
        cv: 'https://drive.google.com/minhthu-cv',
        status: 'scored',
        slotId: 'slot-3',
        checkedInHours: -24,
        screenScore: 89,
        screenResult: 'clear_pass',
        subHours: -68,
        scorecardScores: [
          {
            interviewerId: board2Id,
            scores: { 'crit-attitude': 9.0, 'crit-skill': 9.2, 'crit-problem': 8.5, 'crit-teamwork': 8.0, 'crit-culture': 9.0 },
            comment: 'Kiến thức kinh tế vững, khả năng biên tập câu hỏi talkshow xuất sắc.',
          },
        ],
      },
      {
        id: 'app-24',
        name: 'Đinh Tuấn Kiệt',
        sid: '231121521124',
        cls: '49K18.1',
        email: 'tuankiet@due.udn.vn',
        phone: '0905000124',
        d1: 'dept-logistics',
        d2: 'dept-er',
        exp: 'Từng hỗ trợ bưng bê hậu cần sự kiện cấp trường.',
        essay: 'Em muốn rèn luyện thêm.',
        cv: 'https://drive.google.com/tuankiet-cv',
        status: 'scored',
        slotId: 'slot-3',
        checkedInHours: -24,
        screenScore: 76,
        screenResult: 'clear_pass',
        subHours: -66,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 6.0, 'crit-skill': 5.5, 'crit-problem': 5.0, 'crit-teamwork': 6.0, 'crit-culture': 5.5 },
            comment: 'Trả lời tình huống còn lúng túng, lịch học trùng nhiều buổi chạy sự kiện.',
          },
        ],
      },
      // 25-26: Decided Pass / Decided Fail (BCN has selected decision, waiting to click "Chốt và gửi")
      {
        id: 'app-25',
        name: 'Trương Khánh Vy',
        sid: '221121521125',
        cls: '48K05.1',
        email: 'khanhvy@due.udn.vn',
        phone: '0905000125',
        d1: 'dept-content',
        d2: 'dept-media',
        exp: 'Chủ nhiệm nhóm nghiên cứu khoa học sinh viên đạt giải Nhất cấp Khoa, kinh nghiệm làm MC song ngữ.',
        essay: 'Em mong muốn đóng góp vào chất lượng học thuật của C-res Forum.',
        cv: 'https://linkedin.com/in/khanhvy-due',
        status: 'decided_pass',
        slotId: 'slot-2',
        checkedInHours: -36,
        screenScore: 95,
        screenResult: 'clear_pass',
        subHours: -85,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 9.5, 'crit-skill': 9.5, 'crit-problem': 9.0, 'crit-teamwork': 9.0, 'crit-culture': 9.5 },
            comment: 'Ứng viên xuất sắc cho Ban Nội dung.',
          },
        ],
        selectionDecision: {
          totalScore: 93.25,
          decision: 'pass',
          note: 'Đạt điểm cao nhất đợt phỏng vấn buổi 2, bổ sung nhân sự nòng cốt Ban Nội dung.',
          notified: false,
        },
      },
      {
        id: 'app-26',
        name: 'Mai Xuân Trường',
        sid: '231121521126',
        cls: '49K11.1',
        email: 'xuantruong@due.udn.vn',
        phone: '0905000126',
        d1: 'dept-media',
        d2: 'dept-logistics',
        exp: 'Có biết chụp ảnh bằng điện thoại cho lớp.',
        essay: 'Em muốn học thêm thiết kế.',
        cv: 'https://drive.google.com/xuantruong-cv',
        status: 'decided_fail',
        slotId: 'slot-2',
        checkedInHours: -36,
        screenScore: 76,
        screenResult: 'clear_pass',
        subHours: -84,
        scorecardScores: [
          {
            interviewerId: board2Id,
            scores: { 'crit-attitude': 6.5, 'crit-skill': 5.0, 'crit-problem': 5.5, 'crit-teamwork': 6.0, 'crit-culture': 6.0 },
            comment: 'Kỹ năng chuyên môn chưa đáp ứng yêu cầu chạy sự kiện ngay.',
          },
        ],
        selectionDecision: {
          totalScore: 57.75,
          decision: 'fail',
          note: 'Điểm phỏng vấn dưới mức chuẩn của Ban Truyền thông.',
          notified: false,
        },
      },
      // 27-29: Failed interview (END #4: Ứng viên không đạt - already finalized & notified)
      {
        id: 'app-27',
        name: 'Hà Quốc Hưng',
        sid: '231121521127',
        cls: '49K20.1',
        email: 'quochung@due.udn.vn',
        phone: '0905000127',
        d1: 'dept-er',
        d2: 'dept-logistics',
        exp: 'Từng tham gia tình nguyện hè.',
        essay: 'Em muốn thử sức ở mảng đối ngoại.',
        cv: 'https://drive.google.com/quochung',
        status: 'failed_interview',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 78,
        screenResult: 'clear_pass',
        endReason: 'failed_interview',
        subHours: -115,
        finHours: -30,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 6.0, 'crit-skill': 5.5, 'crit-problem': 5.5, 'crit-teamwork': 6.0, 'crit-culture': 6.0 },
            comment: 'Chưa có kinh nghiệm giao tiếp đối tác doanh nghiệp.',
          },
        ],
        selectionDecision: {
          totalScore: 57.75,
          decision: 'fail',
          note: 'Chưa đạt yêu cầu vòng phỏng vấn.',
          notified: true,
        },
      },
      {
        id: 'app-28',
        name: 'Đoàn Thị Mai Hương',
        sid: '221121521128',
        cls: '48K13.2',
        email: 'maihuong@due.udn.vn',
        phone: '0905000128',
        d1: 'dept-content',
        d2: 'dept-media',
        exp: 'Thành viên nhóm truyền thông nhỏ.',
        essay: 'Em muốn tham gia CLB.',
        cv: 'https://drive.google.com/maihuong',
        status: 'failed_interview',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 76,
        screenResult: 'clear_pass',
        endReason: 'failed_interview',
        subHours: -112,
        finHours: -30,
        scorecardScores: [
          {
            interviewerId: board2Id,
            scores: { 'crit-attitude': 6.5, 'crit-skill': 6.0, 'crit-problem': 5.5, 'crit-teamwork': 6.0, 'crit-culture': 6.0 },
            comment: 'Cần trau dồi thêm kỹ năng lập kế hoạch nội dung.',
          },
        ],
        selectionDecision: {
          totalScore: 60.25,
          decision: 'fail',
          note: 'Điểm tổng hợp thấp hơn chỉ tiêu lấy của ban.',
          notified: true,
        },
      },
      {
        id: 'app-29',
        name: 'Lâm Nhật Minh',
        sid: '231121521129',
        cls: '49K04.2',
        email: 'nhatminh@due.udn.vn',
        phone: '0905000129',
        d1: 'dept-logistics',
        d2: 'dept-media',
        exp: 'Hỗ trợ hậu cần lớp.',
        essay: 'Em mong muốn tham gia CLB C-res.',
        cv: 'https://drive.google.com/nhatminh',
        status: 'failed_interview',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 75,
        screenResult: 'clear_pass',
        endReason: 'failed_interview',
        subHours: -110,
        finHours: -30,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 6.0, 'crit-skill': 6.0, 'crit-problem': 6.0, 'crit-teamwork': 6.0, 'crit-culture': 6.0 },
            comment: 'Thái độ tốt nhưng chưa sẵn sàng cam kết lịch họp tối.',
          },
        ],
        selectionDecision: {
          totalScore: 60.0,
          decision: 'fail',
          note: 'Không đảm bảo thời gian họp định kỳ.',
          notified: true,
        },
      },
      // 30: Offer sent (Passed & notified, waiting for candidate to click "Xác nhận và tham gia nhóm")
      {
        id: 'app-30',
        name: 'Nguyễn Trần Bảo Ngọc',
        sid: '221121521130',
        cls: '48K02.2',
        email: 'ntbaongoc@due.udn.vn',
        phone: '0905000130',
        d1: 'dept-media',
        d2: 'dept-content',
        exp: 'Thiết kế chính cho 4 sự kiện lớn tại ĐH Kinh tế ĐHĐN, thành thạo Illustrator, Premiere Pro.',
        essay: 'Em muốn nâng tầm nhận diện thương hiệu cho chuỗi sự kiện C-res.',
        cv: 'https://behance.net/ntbaongoc',
        status: 'offer_sent',
        slotId: 'slot-2',
        checkedInHours: -36,
        screenScore: 94,
        screenResult: 'clear_pass',
        subHours: -90,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 9.0, 'crit-skill': 9.5, 'crit-problem': 8.5, 'crit-teamwork': 9.0, 'crit-culture': 9.0 },
            comment: 'Kỹ năng thiết kế & dựng video xuất sắc.',
          },
        ],
        selectionDecision: {
          totalScore: 90.25,
          decision: 'pass',
          note: 'Trúng tuyển xuất sắc.',
          notified: true,
        },
      },
      // 31-34: Confirmed joined (Candidate confirmed & joined Zalo group -> Waiting in HR AI Department Assignment queue!)
      {
        id: 'app-31',
        name: 'Phạm Lê Minh Hiếu',
        sid: '221121521131',
        cls: '48K01.1',
        email: 'minhhieu@due.udn.vn',
        phone: '0905000131',
        d1: 'dept-media',
        d2: 'dept-logistics',
        exp: 'Photographer & Videographer tự do tại Đà Nẵng, đã từng quay recap cho đêm nhạc sinh viên DUE.',
        essay: 'Em muốn phụ trách mảng media sản xuất hình ảnh sự kiện cho CLB C-res.',
        cv: 'https://behance.net/minhhieu-photo',
        status: 'confirmed_joined',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 92,
        screenResult: 'clear_pass',
        subHours: -115,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 9.2, 'crit-skill': 9.5, 'crit-problem': 8.5, 'crit-teamwork': 8.8, 'crit-culture': 9.0 },
            comment: 'Có sẵn thiết bị máy ảnh và kỹ năng hậu kỳ cực tốt.',
          },
        ],
        selectionDecision: {
          totalScore: 90.45,
          decision: 'pass',
          note: 'Trúng tuyển, ưu tiên phân vào Ban Truyền thông.',
          notified: true,
        },
        assignmentSpec: {
          deptId: 'dept-media',
          aiDeptId: 'dept-media',
          aiReason: 'Điểm phỏng vấn rất cao (90.5đ), có kinh nghiệm quay chụp thực chiến khớp hoàn toàn với Nguyện vọng 1 (Ban Truyền thông).',
          status: 'suggested',
        },
      },
      {
        id: 'app-32',
        name: 'Võ Thị Quỳnh Như',
        sid: '221121521132',
        cls: '48K06.2',
        email: 'quynhnhu@due.udn.vn',
        phone: '0905000132',
        d1: 'dept-er',
        d2: 'dept-content',
        exp: 'Trưởng nhóm quan hệ đối tác CLB Tiếng Anh DUE, từng làm việc với 12 nhà tài trợ giáo dục tại Đà Nẵng.',
        essay: 'Em mong muốn mở rộng mạng lưới đối tác doanh nghiệp cho C-res.',
        cv: 'https://linkedin.com/in/quynhnhu-due',
        status: 'confirmed_joined',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 91,
        screenResult: 'clear_pass',
        subHours: -114,
        scorecardScores: [
          {
            interviewerId: board2Id,
            scores: { 'crit-attitude': 9.0, 'crit-skill': 9.0, 'crit-problem': 8.8, 'crit-teamwork': 9.2, 'crit-culture': 9.0 },
            comment: 'Kỹ năng pitching hồ sơ tài trợ rất thuyết phục.',
          },
        ],
        selectionDecision: {
          totalScore: 89.9,
          decision: 'pass',
          note: 'Trúng tuyển Ban Đối ngoại.',
          notified: true,
        },
        assignmentSpec: {
          deptId: 'dept-er',
          aiDeptId: 'dept-er',
          aiReason: 'Kinh nghiệm gọi tài trợ với 12 đối tác doanh nghiệp rất mạnh, đạt 89.9đ, phù hợp tối đa với Nguyện vọng 1 (Ban Đối ngoại).',
          status: 'suggested',
        },
      },
      {
        id: 'app-33',
        name: 'Nguyễn Đình Trọng',
        sid: '221121521133',
        cls: '48K09.2',
        email: 'dinhtrong@due.udn.vn',
        phone: '0905000133',
        d1: 'dept-logistics',
        d2: 'dept-er',
        exp: 'Đội trưởng đội hậu cần sự kiện Khoa Kế toán, thông thuộc quy trình mượn hội trường và thiết bị tại DUE.',
        essay: 'Em muốn đảm bảo mọi sự kiện của C-res vận hành trơn tru, không xảy ra sự cố kỹ thuật.',
        cv: 'https://drive.google.com/dinhtrong-cv',
        status: 'confirmed_joined',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 88,
        screenResult: 'clear_pass',
        subHours: -110,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 9.0, 'crit-skill': 8.8, 'crit-problem': 9.0, 'crit-teamwork': 8.5, 'crit-culture': 8.8 },
            comment: 'Rất rành quy trình thủ tục mượn phòng ban tại trường.',
          },
        ],
        selectionDecision: {
          totalScore: 88.45,
          decision: 'pass',
          note: 'Trúng tuyển.',
          notified: true,
        },
        assignmentSpec: {
          deptId: 'dept-logistics',
          aiDeptId: 'dept-logistics',
          aiReason: 'Nắm rõ nghiệp vụ điều phối hội trường tại ĐH Kinh tế ĐHĐN, khớp Nguyện vọng 1 (Ban Hậu cần) và ban còn chỉ tiêu.',
          status: 'suggested',
        },
      },
      {
        id: 'app-34',
        name: 'Lê Thanh Thảo',
        sid: '221121521134',
        cls: '48K04.2',
        email: 'lethanhthao@due.udn.vn',
        phone: '0905000134',
        d1: 'dept-content',
        d2: 'dept-media',
        exp: 'Đồng tác giả bài nghiên cứu khoa học sinh viên đạt giải Ba cấp Trường, viết kịch bản talkshow kinh tế số.',
        essay: 'Em muốn xây dựng nội dung chuyên mục C-res Insights chất lượng cao.',
        cv: 'https://linkedin.com/in/lethanhthao',
        status: 'confirmed_joined',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 90,
        screenResult: 'clear_pass',
        subHours: -108,
        scorecardScores: [
          {
            interviewerId: board2Id,
            scores: { 'crit-attitude': 8.8, 'crit-skill': 9.2, 'crit-problem': 8.5, 'crit-teamwork': 8.8, 'crit-culture': 9.0 },
            comment: 'Tư duy biên tập kịch bản học thuật rất sắc bén.',
          },
        ],
        selectionDecision: {
          totalScore: 88.7,
          decision: 'pass',
          note: 'Trúng tuyển.',
          notified: true,
        },
        assignmentSpec: {
          deptId: 'dept-content',
          aiDeptId: 'dept-content',
          aiReason: 'Nền tảng nghiên cứu khoa học tốt (88.7đ), phù hợp với Nguyện vọng 1 (Ban Nội dung).',
          status: 'suggested',
        },
      },
      // 35-40: Completed (END #6: Hoàn tất quy trình tuyển CTV - 6 candidates already assigned & notified!)
      {
        id: 'app-35',
        name: 'Trần Hoàng Phúc',
        sid: '211121521135',
        cls: '47K01.1',
        email: 'hoangphuc@due.udn.vn',
        phone: '0905000135',
        d1: 'dept-media',
        d2: 'dept-content',
        exp: 'Trưởng nhóm thiết kế CLB Âm nhạc, 2 năm kinh nghiệm quản trị truyền thông sự kiện.',
        essay: 'Đóng góp hết mình cho C-res.',
        cv: 'https://behance.net/hoangphuc',
        status: 'completed',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 95,
        screenResult: 'clear_pass',
        endReason: 'completed',
        subHours: -140,
        finHours: -12,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 9.5, 'crit-skill': 9.5, 'crit-problem': 9.2, 'crit-teamwork': 9.0, 'crit-culture': 9.5 },
            comment: 'Ứng viên xuất sắc.',
          },
        ],
        selectionDecision: { totalScore: 93.65, decision: 'pass', note: 'Đậu xuất sắc.', notified: true },
        assignmentSpec: {
          deptId: 'dept-media',
          aiDeptId: 'dept-media',
          aiReason: 'Đạt 93.65đ, kinh nghiệm thiết kế dày dặn cho Ban Truyền thông.',
          status: 'confirmed',
        },
      },
      {
        id: 'app-36',
        name: 'Nguyễn Thị Kim Ngân',
        sid: '211121521136',
        cls: '47K05.2',
        email: 'kimngan@due.udn.vn',
        phone: '0905000136',
        d1: 'dept-content',
        d2: 'dept-er',
        exp: 'Biên tập viên nội dung fanpage học thuật, đạt IELTS 7.5 và giải Nhì nghiên cứu khoa học.',
        essay: 'Phát triển nội dung chuyên môn cho CLB C-res.',
        cv: 'https://linkedin.com/in/kimngan',
        status: 'completed',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 94,
        screenResult: 'clear_pass',
        endReason: 'completed',
        subHours: -138,
        finHours: -10,
        scorecardScores: [
          {
            interviewerId: board2Id,
            scores: { 'crit-attitude': 9.5, 'crit-skill': 9.2, 'crit-problem': 9.0, 'crit-teamwork': 9.0, 'crit-culture': 9.2 },
            comment: 'Rất phù hợp Ban Nội dung.',
          },
        ],
        selectionDecision: { totalScore: 92.05, decision: 'pass', note: 'Đậu.', notified: true },
        assignmentSpec: {
          deptId: 'dept-content',
          aiDeptId: 'dept-content',
          aiReason: 'Năng lực biên tập học thuật nổi trội (92.05đ), khớp Nguyện vọng 1 (Ban Nội dung).',
          status: 'confirmed',
        },
      },
      {
        id: 'app-37',
        name: 'Phan Minh Đức',
        sid: '221121521137',
        cls: '48K12.1',
        email: 'minhduc@due.udn.vn',
        phone: '0905000137',
        d1: 'dept-logistics',
        d2: 'dept-er',
        exp: 'Điều phối viên hậu cần 5 sự kiện lớn của Hội Sinh viên ĐH Kinh tế ĐHĐN.',
        essay: 'Xây dựng đội ngũ hậu cần vững mạnh.',
        cv: 'https://drive.google.com/minhduc',
        status: 'completed',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 90,
        screenResult: 'clear_pass',
        endReason: 'completed',
        subHours: -135,
        finHours: -10,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 9.2, 'crit-skill': 9.0, 'crit-problem': 9.0, 'crit-teamwork': 9.0, 'crit-culture': 9.0 },
            comment: 'Kinh nghiệm hậu cần rất dày dặn.',
          },
        ],
        selectionDecision: { totalScore: 90.5, decision: 'pass', note: 'Đậu.', notified: true },
        assignmentSpec: {
          deptId: 'dept-logistics',
          aiDeptId: 'dept-logistics',
          aiReason: 'Kinh nghiệm điều phối 5 sự kiện cấp trường, khớp Nguyện vọng 1 (Ban Hậu cần).',
          status: 'confirmed',
        },
      },
      {
        id: 'app-38',
        name: 'Lê Hoàng Phương Uyên',
        sid: '221121521138',
        cls: '48K08.1',
        email: 'phuonguyen@due.udn.vn',
        phone: '0905000138',
        d1: 'dept-er',
        d2: 'dept-content',
        exp: 'Thành viên đối ngoại dự án AIESEC tại Đà Nẵng, kỹ năng giao tiếp doanh nghiệp xuất sắc.',
        essay: 'Đem lại nguồn tài trợ bền vững cho CLB.',
        cv: 'https://linkedin.com/in/phuonguyen',
        status: 'completed',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 93,
        screenResult: 'clear_pass',
        endReason: 'completed',
        subHours: -132,
        finHours: -9,
        scorecardScores: [
          {
            interviewerId: board2Id,
            scores: { 'crit-attitude': 9.2, 'crit-skill': 9.4, 'crit-problem': 8.8, 'crit-teamwork': 9.2, 'crit-culture': 9.0 },
            comment: 'Phong thái chuyên nghiệp, rất hợp Ban Đối ngoại.',
          },
        ],
        selectionDecision: { totalScore: 91.4, decision: 'pass', note: 'Đậu.', notified: true },
        assignmentSpec: {
          deptId: 'dept-er',
          aiDeptId: 'dept-er',
          aiReason: 'Điểm đối ngoại cao (91.4đ), kinh nghiệm AIESEC phù hợp Ban Đối ngoại.',
          status: 'confirmed',
        },
      },
      {
        id: 'app-39',
        name: 'Đặng Quốc Khánh',
        sid: '221121521139',
        cls: '48K15.2',
        email: 'quockhanh@due.udn.vn',
        phone: '0905000139',
        d1: 'dept-logistics',
        d2: 'dept-media',
        exp: 'Phụ trách kỹ thuật âm thanh ánh sáng cho CLB Văn nghệ xung kích DUE.',
        essay: 'Hỗ trợ kỹ thuật hội trường cho C-res.',
        cv: 'https://drive.google.com/quockhanh',
        status: 'completed',
        slotId: 'slot-2',
        checkedInHours: -36,
        screenScore: 87,
        screenResult: 'clear_pass',
        endReason: 'completed',
        subHours: -128,
        finHours: -8,
        scorecardScores: [
          {
            interviewerId: board1Id,
            scores: { 'crit-attitude': 8.8, 'crit-skill': 9.0, 'crit-problem': 8.8, 'crit-teamwork': 8.6, 'crit-culture': 8.8 },
            comment: 'Nắm vững kỹ thuật âm thanh hội trường.',
          },
        ],
        selectionDecision: { totalScore: 88.2, decision: 'pass', note: 'Đậu.', notified: true },
        assignmentSpec: {
          deptId: 'dept-logistics',
          aiDeptId: 'dept-logistics',
          aiReason: 'Chuyên môn kỹ thuật âm thanh ánh sáng phù hợp với Ban Hậu cần.',
          status: 'confirmed',
        },
      },
      {
        id: 'app-40',
        name: 'Ngô Thị Bích Ngọc',
        sid: '221121521140',
        cls: '48K03.1',
        email: 'bichngoc@due.udn.vn',
        phone: '0905000140',
        d1: 'dept-media',
        d2: 'dept-content',
        exp: 'Content creator & Designer cho fanpage Khoa Kinh doanh Quốc tế DUE.',
        essay: 'Sáng tạo nội dung truyền thông đa kênh.',
        cv: 'https://behance.net/bichngoc',
        status: 'completed',
        slotId: 'slot-2',
        checkedInHours: -36,
        screenScore: 91,
        screenResult: 'clear_pass',
        endReason: 'completed',
        subHours: -125,
        finHours: -8,
        scorecardScores: [
          {
            interviewerId: board2Id,
            scores: { 'crit-attitude': 9.0, 'crit-skill': 9.0, 'crit-problem': 8.6, 'crit-teamwork': 9.0, 'crit-culture': 9.0 },
            comment: 'Đa năng cả thiết kế lẫn viết bài truyền thông.',
          },
        ],
        selectionDecision: { totalScore: 89.2, decision: 'pass', note: 'Đậu.', notified: true },
        assignmentSpec: {
          deptId: 'dept-media',
          aiDeptId: 'dept-media',
          aiReason: 'Đạt 89.2đ, đa năng thiết kế và content cho Ban Truyền thông.',
          status: 'confirmed',
        },
      },
      // 41-42: Withdrawn (END #5: Đã rút đơn - including 1 who withdrew AFTER assignment, demonstrating automatic quota compensation!)
      {
        id: 'app-41',
        name: 'Châu Gia Kiệt',
        sid: '221121521141',
        cls: '48K17.1',
        email: 'giakiet@due.udn.vn',
        phone: '0905000141',
        d1: 'dept-er',
        d2: 'dept-logistics',
        exp: 'Từng tham gia CLB kỹ năng tại Đà Nẵng.',
        essay: 'Em muốn tham gia Ban Đối ngoại.',
        cv: 'https://linkedin.com/in/giakiet',
        status: 'withdrawn',
        screenScore: 84,
        screenResult: 'clear_pass',
        endReason: 'withdrawn',
        withdrawReason: 'Em vừa nhận lịch học quân sự tập trung trùng với thời gian diễn ra sự kiện.',
        subHours: -100,
        finHours: -40,
      },
      {
        id: 'app-42',
        name: 'Huỳnh Mai Phương',
        sid: '221121521142',
        cls: '48K10.1',
        email: 'maiphuong@due.udn.vn',
        phone: '0905000142',
        d1: 'dept-content',
        d2: 'dept-media',
        exp: 'Biên tập viên CLB Truyền thông trẻ, kinh nghiệm viết bài PR sự kiện.',
        essay: 'Mong muốn đồng hành cùng C-res.',
        cv: 'https://linkedin.com/in/maiphuong',
        status: 'withdrawn',
        slotId: 'slot-1',
        checkedInHours: -48,
        screenScore: 89,
        screenResult: 'clear_pass',
        endReason: 'withdrawn',
        withdrawReason: 'Gia đình có việc đột xuất phải bảo lưu học kỳ này nên xin phép rút khỏi Ban Nội dung.',
        subHours: -130,
        finHours: -5,
        assignmentSpec: {
          deptId: 'dept-content',
          aiDeptId: 'dept-content',
          aiReason: 'Phù hợp Ban Nội dung.',
          status: 'revoked', // Revoked automatically upon withdrawal!
        },
      },
    ];

    const insertApp = db.prepare(`
      INSERT INTO applications (
        id, round_id, user_id, full_name, student_id, class_name, email, phone,
        first_choice_dept_id, second_choice_dept_id, experience, essay, cv_url,
        commitment_confirmed, is_active_student, status,
        supplement_count, supplement_deadline_at,
        schedule_link_sent_at, schedule_reminded_at, schedule_deadline_at,
        screening_score, screening_result, is_near_threshold,
        end_reason, withdraw_reason, submitted_at, finished_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        1, 1, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    const insertMissing = db.prepare(`
      INSERT INTO application_missing_fields (id, application_id, field_name, round_no, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertReview = db.prepare(`
      INSERT INTO review_decisions (id, application_id, reviewer_id, decision, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertBooking = db.prepare(`
      INSERT INTO interview_bookings (id, application_id, slot_id, booked_at, checked_in_at, no_show, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const insertScorecard = db.prepare(`
      INSERT INTO scorecards (id, application_id, interviewer_id, scores, comment, submitted_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSelection = db.prepare(`
      INSERT INTO selection_decisions (id, application_id, total_score, decision, decided_by, note, notified_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAssignment = db.prepare(`
      INSERT INTO assignments (id, application_id, department_id, ai_suggested_dept_id, ai_reason, status, confirmed_by, notified_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, application_id, actor, action, rule_applied, input_snapshot, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of specs) {
      let uid = s.userId;
      if (!uid) {
        uid = `user-${s.id}`;
        insertUser.run(uid, s.email, passwordHash, s.name, 'candidate', isoAt(s.subHours), isoAt(s.subHours));
      }

      const subIso = isoAt(s.subHours);
      const finIso = s.finHours != null ? isoAt(s.finHours) : null;
      const suppDeadlineIso = s.suppDeadlineHours != null ? isoAt(s.suppDeadlineHours) : null;
      const schedSentIso = s.schedSentHours != null ? isoAt(s.schedSentHours) : null;
      const schedRemindedIso = s.schedRemindedHours != null ? isoAt(s.schedRemindedHours) : null;
      const schedDeadlineIso = s.schedDeadlineHours != null ? isoAt(s.schedDeadlineHours) : null;

      insertApp.run(
        s.id,
        roundId,
        uid,
        s.name,
        s.sid,
        s.cls,
        s.email,
        s.phone,
        s.d1,
        s.d2 || null,
        s.exp,
        s.essay,
        s.cv,
        s.status,
        s.suppCount ?? 0,
        suppDeadlineIso,
        schedSentIso,
        schedRemindedIso,
        schedDeadlineIso,
        s.screenScore,
        s.screenResult,
        s.nearThreshold ?? 0,
        s.endReason ?? null,
        s.withdrawReason ?? null,
        subIso,
        finIso,
        subIso,
        finIso || isoAt(-1)
      );

      // Missing fields
      if (s.missingFields && s.missingFields.length > 0) {
        for (const f of s.missingFields) {
          insertMissing.run(crypto.randomUUID(), s.id, f, s.suppCount || 1, subIso, subIso);
        }
      }

      // Initial submission audit log
      insertAudit.run(
        crypto.randomUUID(),
        s.id,
        `user:${uid}`,
        'SUBMIT_APPLICATION',
        'Candidate Registration Form Validation',
        JSON.stringify({ full_name: s.name, student_id: s.sid, first_choice: s.d1 }),
        'Ứng viên đã nộp hồ sơ đăng ký đợt tuyển CTV.',
        subIso
      );

      // Automated screening / supplement audit logs
      if (s.status === 'needs_supplement' || s.status === 'expired_supplement') {
        const missingLabels = (s.missingFields || []).map((f) => REQUIRED_FIELD_LABELS[f] || f).join(', ');
        insertAudit.run(
          crypto.randomUUID(),
          s.id,
          'system',
          'REQUEST_SUPPLEMENT',
          'checkRequiredFields -> missingFields.length > 0',
          JSON.stringify({ missingFields: s.missingFields, supplementCount: s.suppCount }),
          `Hệ thống tự động yêu cầu bổ sung (Thiếu: ${missingLabels}).`,
          isoAt(s.subHours + 0.1)
        );
        NotificationService.send({
          applicationId: s.id,
          toEmail: s.email,
          templateKey: 'supplement_request',
          variables: {
            full_name: s.name,
            missing_fields: missingLabels,
            deadline: suppDeadlineIso ? new Date(suppDeadlineIso).toLocaleString('vi-VN') : 'Sau 2 ngày',
            link: '/my-application',
          },
          createdAt: isoAt(s.subHours + 0.1),
        });
      }

      if (s.status === 'expired_supplement' && finIso) {
        insertAudit.run(
          crypto.randomUUID(),
          s.id,
          'system',
          'TIMER_EXPIRED_SUPPLEMENT',
          'isSupplementExpired(deadline <= now, maxDays=2)',
          JSON.stringify({ supplementCount: s.suppCount, missingFields: s.missingFields }),
          'Tự động loại hồ sơ do quá hạn 2 ngày bổ sung thông tin.',
          finIso
        );
        NotificationService.send({
          applicationId: s.id,
          toEmail: s.email,
          templateKey: 'expired_supplement',
          variables: {
            full_name: s.name,
            deadline: new Date(finIso).toLocaleString('vi-VN'),
            link: '/my-application',
          },
          createdAt: finIso,
        });
      }

      if (s.screenScore !== null) {
        insertAudit.run(
          crypto.randomUUID(),
          s.id,
          'system',
          'AUTO_SCREENING_RESULT',
          `screenByThreshold(score=${s.screenScore}, X=75, Y=50, margin=5)`,
          JSON.stringify({ score: s.screenScore, branch: s.screenResult, nearThreshold: Boolean(s.nearThreshold) }),
          `Sơ loại tự động: ${s.screenScore} điểm → Nhánh "${s.screenResult}".`,
          isoAt(s.subHours + 0.2)
        );
      }

      if (s.reviewSpec) {
        insertReview.run(
          crypto.randomUUID(),
          s.id,
          hrId,
          s.reviewSpec.decision,
          s.reviewSpec.reason,
          finIso || isoAt(-40),
          finIso || isoAt(-40)
        );
        insertAudit.run(
          crypto.randomUUID(),
          s.id,
          `user:${hrId}`,
          'HR_MANUAL_REVIEW',
          'Manual Review Decision on Needs-Review Queue',
          JSON.stringify(s.reviewSpec),
          `HR duyệt tay: ${s.reviewSpec.decision === 'pass' ? 'Đạt' : 'Không đạt'} (${s.reviewSpec.reason})`,
          finIso || isoAt(-40)
        );
      }

      if (s.status === 'rejected_docs' && finIso) {
        NotificationService.send({
          applicationId: s.id,
          toEmail: s.email,
          templateKey: 'docs_rejected',
          variables: {
            full_name: s.name,
            reason: s.reviewSpec?.reason || `Điểm sơ loại (${s.screenScore}đ) thấp hơn ngưỡng Y (50đ)`,
          },
          createdAt: finIso,
        });
      }

      if (s.schedSentHours != null) {
        NotificationService.send({
          applicationId: s.id,
          toEmail: s.email,
          templateKey: 'schedule_link',
          variables: {
            full_name: s.name,
            link: '/my-application',
            deadline: schedDeadlineIso ? new Date(schedDeadlineIso).toLocaleString('vi-VN') : 'Trong 2 ngày',
          },
          createdAt: isoAt(s.schedSentHours),
        });
      }

      if (s.schedRemindedHours != null) {
        insertAudit.run(
          crypto.randomUUID(),
          s.id,
          'system',
          'TIMER_REMIND_BOOKING',
          'shouldRemind(remindAfterDays=1, remindedAt=null)',
          JSON.stringify({ scheduleLinkSentAt: schedSentIso }),
          'Tự động gửi thư nhắc đặt lịch phỏng vấn sau 1 ngày (chỉ nhắc 1 lần).',
          isoAt(s.schedRemindedHours)
        );
        NotificationService.send({
          applicationId: s.id,
          toEmail: s.email,
          templateKey: 'schedule_reminder',
          variables: {
            full_name: s.name,
            link: '/my-application',
            deadline: schedDeadlineIso ? new Date(schedDeadlineIso).toLocaleString('vi-VN') : '',
          },
          createdAt: isoAt(s.schedRemindedHours),
        });
      }

      if (s.status === 'no_booking' && finIso) {
        insertAudit.run(
          crypto.randomUUID(),
          s.id,
          'system',
          'TIMER_DROP_NO_BOOKING',
          'shouldDrop(unbookAfterDays=2)',
          JSON.stringify({ scheduleLinkSentAt: schedSentIso }),
          'Tự động gạch tên khỏi danh sách do quá 2 ngày không đặt lịch ("Ứng viên không tham gia").',
          finIso
        );
        NotificationService.send({
          applicationId: s.id,
          toEmail: s.email,
          templateKey: 'removed_no_booking',
          variables: {
            full_name: s.name,
            deadline: new Date(finIso).toLocaleString('vi-VN'),
          },
          createdAt: finIso,
        });
      }

      if (s.slotId && s.status !== 'withdrawn') {
        const bookedIso = isoAt(s.subHours + 4);
        const checkedIso = s.checkedInHours != null ? isoAt(s.checkedInHours) : null;
        insertBooking.run(
          crypto.randomUUID(),
          s.id,
          s.slotId,
          bookedIso,
          checkedIso,
          bookedIso,
          checkedIso || bookedIso
        );
      }

      if (s.scorecardScores && s.scorecardScores.length > 0) {
        for (const sc of s.scorecardScores) {
          const scIso = isoAt((s.checkedInHours ?? -24) + 1);
          insertScorecard.run(
            crypto.randomUUID(),
            s.id,
            sc.interviewerId,
            JSON.stringify(sc.scores),
            sc.comment,
            scIso,
            scIso,
            scIso
          );
        }
        insertAudit.run(
          crypto.randomUUID(),
          s.id,
          'system',
          'AND_JOIN_INTERVIEW_CONVERGED',
          'canConvergeInterviewAndJoin(checkedIn=true, scorecards >= 1)',
          JSON.stringify({ scorecardCount: s.scorecardScores.length }),
          'Hội tụ AND-join hoàn tất: Đã check-in và đủ số phiếu điểm tối thiểu.',
          isoAt((s.checkedInHours ?? -24) + 1.2)
        );
      }

      if (s.selectionDecision) {
        const decIso = isoAt((s.checkedInHours ?? -36) + 4);
        const notIso = s.selectionDecision.notified ? isoAt((s.checkedInHours ?? -36) + 5) : null;
        insertSelection.run(
          crypto.randomUUID(),
          s.id,
          s.selectionDecision.totalScore,
          s.selectionDecision.decision,
          board1Id,
          s.selectionDecision.note,
          notIso,
          decIso,
          notIso || decIso
        );

        if (s.selectionDecision.notified && notIso) {
          NotificationService.send({
            applicationId: s.id,
            toEmail: s.email,
            templateKey: s.selectionDecision.decision === 'pass' ? 'result_pass' : 'result_fail',
            variables: {
              full_name: s.name,
              link: '/my-application',
            },
            createdAt: notIso,
          });
        }
      }

      if (s.assignmentSpec) {
        const assIso = finIso || isoAt(-15);
        const isConf = s.assignmentSpec.status === 'confirmed';
        insertAssignment.run(
          crypto.randomUUID(),
          s.id,
          s.assignmentSpec.deptId,
          s.assignmentSpec.aiDeptId,
          s.assignmentSpec.aiReason,
          s.assignmentSpec.status,
          isConf ? hrId : null,
          isConf ? assIso : null,
          assIso,
          assIso
        );

        if (isConf) {
          const deptName = depts.find((d) => d.id === s.assignmentSpec?.deptId)?.name || 'Ban chuyên môn';
          NotificationService.send({
            applicationId: s.id,
            toEmail: s.email,
            templateKey: 'assignment_info',
            variables: {
              full_name: s.name,
              department: deptName,
              link: 'https://zalo.me/g/cres-ctv-gen2026-due',
            },
            createdAt: assIso,
          });
          insertAudit.run(
            crypto.randomUUID(),
            s.id,
            `user:${hrId}`,
            'CONFIRM_DEPARTMENT_ASSIGNMENT',
            'HR Finalized AI Department Suggestion',
            JSON.stringify({ departmentId: s.assignmentSpec.deptId, aiSuggested: s.assignmentSpec.aiDeptId }),
            `Đã chốt phân công vào ${deptName} và gửi thông báo hoàn tất quy trình tuyển CTV.`,
            assIso
          );
        }
      }

      if (s.status === 'withdrawn' && finIso) {
        if (s.assignmentSpec?.status === 'revoked') {
          insertAudit.run(
            crypto.randomUUID(),
            s.id,
            'system',
            'COMPENSATE_REVOKE_ASSIGNMENT',
            'Withdraw Exception -> Revoke Confirmed Assignment & Restore Quota',
            JSON.stringify({ departmentId: s.assignmentSpec.deptId }),
            'Tự động hoàn tác phân công Ban Nội dung và hoàn trả 1 chỉ tiêu cho ban.',
            finIso
          );
        }
        insertAudit.run(
          crypto.randomUUID(),
          s.id,
          `user:${uid}`,
          'CANDIDATE_WITHDRAW',
          'Global Withdraw Exception (Terminate Case)',
          JSON.stringify({ withdrawReason: s.withdrawReason }),
          `Ứng viên rút đơn (${s.withdrawReason}). Đã hủy toàn bộ timer của case.`,
          finIso
        );
        NotificationService.send({
          applicationId: s.id,
          toEmail: s.email,
          templateKey: 'withdrawn_ack',
          variables: {
            full_name: s.name,
            deadline: new Date(finIso).toLocaleString('vi-VN'),
          },
          createdAt: finIso,
        });
      }
    }

    return {
      roundId,
      seededApplications: specs.length,
    };
  });

  return tx();
}
