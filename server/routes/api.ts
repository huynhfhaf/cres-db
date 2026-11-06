import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db, getSetting, setSetting, getSystemNow, getSystemNowIso } from '../db/database.ts';
import type {
  User,
  UserRole,
  Application,
  RecruitmentRound,
  Department,
  ScoringCriterion,
} from '../../src/types.ts';
import {
  transition,
  writeAuditLog,
  runAutomatedCheckAndScreenPipeline,
  sendInterviewBookingInvitation,
  evaluateInterviewAndJoin,
  withdrawApplication,
} from '../services/stateMachine.ts';
import { NotificationService } from '../services/notificationService.ts';
import {
  canBook,
  computeTotalScore,
  evaluateScreeningProfile,
  screenByThreshold,
  isNearThreshold,
  REQUIRED_FIELD_LABELS,
  ALL_APPLICATION_STATUSES,
  isValidStateTransition,
  canConvergeInterviewAndJoin,
  shouldDrop,
} from '../rules/rulesEngine.ts';
import { generateDepartmentAssignments } from '../services/aiAssignmentService.ts';
import { runTimerTick } from '../jobs/timerScheduler.ts';
import { seedDatabase } from '../db/seed.ts';

export const apiRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'cres-recruit-due-secret-key-2026';

// Simple rate limiter for login endpoint
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'local';
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  if (entry.count >= 30) {
    return res.status(429).json({
      error: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 1 phút.',
    });
  }
  entry.count += 1;
  return next();
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: UserRole; full_name: string };
    const userRow = db
      .prepare('SELECT id, email, full_name, role, created_at FROM users WHERE id = ?')
      .get(decoded.id) as User | undefined;
    if (!userRow) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị xóa.' });
    }
    req.user = userRow;
    return next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
}

function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Bạn không có quyền thực hiện thao tác này (Yêu cầu vai trò: ${roles.join(', ')}).`,
      });
    }
    return next();
  };
}

function sanitizeText(val: string | undefined | null): string {
  if (!val) return '';
  return String(val).replace(/[<>]/g, '').trim();
}

function enrichApplication(app: Application): Application {
  const depts = db.prepare('SELECT id, name FROM departments WHERE round_id = ?').all(app.round_id) as Array<{
    id: string;
    name: string;
  }>;
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  const missingRows = db
    .prepare('SELECT field_name FROM application_missing_fields WHERE application_id = ? ORDER BY round_no DESC')
    .all(app.id) as Array<{ field_name: string }>;

  const booking = db
    .prepare(`
      SELECT b.*, s.start_at, s.end_at, s.location_or_link
      FROM interview_bookings b
      JOIN interview_slots s ON s.id = b.slot_id
      WHERE b.application_id = ?
    `)
    .get(app.id) as Application['booking'] | undefined;

  const scorecardsRaw = db
    .prepare(`
      SELECT sc.*, u.full_name as interviewer_name
      FROM scorecards sc
      LEFT JOIN users u ON u.id = sc.interviewer_id
      WHERE sc.application_id = ?
      ORDER BY sc.submitted_at ASC
    `)
    .all(app.id) as Array<{
    id: string;
    application_id: string;
    interviewer_id: string;
    interviewer_name: string;
    scores: string;
    comment: string;
    submitted_at: string;
  }>;

  const scorecards = scorecardsRaw.map((sc) => ({
    ...sc,
    scores: JSON.parse(sc.scores || '{}'),
  }));

  const selectionDecision = db
    .prepare('SELECT * FROM selection_decisions WHERE application_id = ?')
    .get(app.id) as Application['selection_decision'] | undefined;

  const assignmentRow = db
    .prepare('SELECT * FROM assignments WHERE application_id = ?')
    .get(app.id) as Application['assignment'] | undefined;

  if (assignmentRow) {
    assignmentRow.department_name = deptMap.get(assignmentRow.department_id) || '';
    if (assignmentRow.ai_suggested_dept_id) {
      assignmentRow.ai_suggested_dept_name = deptMap.get(assignmentRow.ai_suggested_dept_id) || '';
    }
  }

  const reviewDecision = db
    .prepare(`
      SELECT r.*, u.full_name as reviewer_name
      FROM review_decisions r
      LEFT JOIN users u ON u.id = r.reviewer_id
      WHERE r.application_id = ?
      ORDER BY r.created_at DESC LIMIT 1
    `)
    .get(app.id) as Application['review_decision'] | undefined;

  return {
    ...app,
    first_choice_name: deptMap.get(app.first_choice_dept_id) || app.first_choice_dept_id,
    second_choice_name: app.second_choice_dept_id ? deptMap.get(app.second_choice_dept_id) || '' : '',
    missing_fields: Array.from(new Set(missingRows.map((m) => m.field_name))),
    booking: booking || null,
    scorecards,
    selection_decision: selectionDecision || null,
    assignment: assignmentRow || null,
    review_decision: reviewDecision || null,
  };
}

// ============================================================================
// 1. AUTHENTICATION & DEMO LOGIN
// ============================================================================

const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  full_name: z.string().min(2, 'Họ tên tối thiểu 2 ký tự'),
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' });
  }
  const { email, password, full_name } = parsed.data;
  const cleanEmail = email.trim().toLowerCase();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(400).json({ error: 'Email này đã được đăng ký tài khoản.' });
  }

  const id = crypto.randomUUID();
  const nowIso = getSystemNowIso();
  const passwordHash = bcrypt.hashSync(password, 8);

  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'candidate', ?, ?)
  `).run(id, cleanEmail, passwordHash, sanitizeText(full_name), nowIso, nowIso);

  const user: User = { id, email: cleanEmail, full_name: sanitizeText(full_name), role: 'candidate' };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

  return res.json({ user, token });
});

apiRouter.post('/auth/login', loginRateLimiter, (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu.' });
  }

  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase()) as (User & { password_hash: string }) | undefined;

  if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
  }

  const user: User = { id: row.id, email: row.email, full_name: row.full_name, role: row.role };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ user, token });
});

function isDemoModeEnabled(): boolean {
  if (process.env.DEMO_MODE === 'false') return false;
  return getSetting('DEMO_MODE', 'true') !== 'false';
}

apiRouter.post('/auth/demo', (req: Request, res: Response) => {
  if (!isDemoModeEnabled()) {
    return res.status(403).json({
      error: 'Chế độ đăng nhập nhanh (Demo Mode) đã bị tắt trong cấu hình bảo mật.',
    });
  }

  const { role, email } = req.body || {};
  let userRow: User | undefined;

  if (email) {
    userRow = db
      .prepare('SELECT id, email, full_name, role FROM users WHERE email = ?')
      .get(String(email).trim().toLowerCase()) as User | undefined;
  } else if (role) {
    const targetEmailMap: Record<string, string> = {
      candidate: 'ungvien1@due.udn.vn',
      hr: 'hr@cres.due.udn.vn',
      board: 'bcn@cres.due.udn.vn',
      admin: 'admin@cres.due.udn.vn',
    };
    const targetEmail = targetEmailMap[role];
    if (targetEmail) {
      userRow = db
        .prepare('SELECT id, email, full_name, role FROM users WHERE email = ?')
        .get(targetEmail) as User | undefined;
    }
    if (!userRow) {
      userRow = db
        .prepare('SELECT id, email, full_name, role FROM users WHERE role = ? LIMIT 1')
        .get(role) as User | undefined;
    }
  }

  if (!userRow) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản demo tương ứng.' });
  }

  const token = jwt.sign(userRow, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ user: userRow, token });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    user: req.user,
    systemNow: getSystemNowIso(),
    timeScale: Number(getSetting('TIME_SCALE', '1')) || 1,
    demoMode: isDemoModeEnabled(),
  });
});

// Helper endpoint to list demo accounts in Demo Mode (disabled when DEMO_MODE=false)
apiRouter.get('/auth/demo-accounts', (_req: Request, res: Response) => {
  if (!isDemoModeEnabled()) {
    return res.json({ staff: [], sampleCandidates: [], demoMode: false });
  }

  const staff = db
    .prepare("SELECT id, email, full_name, role FROM users WHERE role IN ('admin','hr','board') ORDER BY role")
    .all() as User[];

  const sampleCandidates = db
    .prepare(`
      SELECT u.id, u.email, u.full_name, u.role, a.status, a.student_id
      FROM users u
      LEFT JOIN applications a ON a.user_id = u.id
      WHERE u.role = 'candidate'
      ORDER BY COALESCE(a.created_at, u.created_at) DESC
    `)
    .all() as Array<User & { status: string; student_id: string }>;

  return res.json({ staff, sampleCandidates, demoMode: true });
});

// ============================================================================
// 2. CURRENT ROUND & METADATA
// ============================================================================

function syncAndGetDepartmentsWithQuotas(roundId: string): Array<
  Department & {
    assigned_count: number;
    remaining_quota: number;
    assignedCount: number;
    remainingQuota: number;
  }
> {
  const departments = db
    .prepare('SELECT * FROM departments WHERE round_id = ? ORDER BY name ASC')
    .all(roundId) as Department[];

  const validDeptIds = new Set(departments.map((d) => d.id));
  const fallbackDeptId = departments[0]?.id || '';
  const nowIso = getSystemNowIso();

  // Ensure every application in 'assigned' or 'completed' has a 'confirmed' row in `assignments`
  const completedOrAssignedApps = db
    .prepare("SELECT id, first_choice_dept_id FROM applications WHERE round_id = ? AND status IN ('assigned', 'completed')")
    .all(roundId) as Array<{ id: string; first_choice_dept_id: string }>;

  for (const app of completedOrAssignedApps) {
    const existing = db
      .prepare('SELECT id, department_id, status FROM assignments WHERE application_id = ?')
      .get(app.id) as { id: string; department_id: string; status: string } | undefined;

    if (!existing) {
      const targetDeptId = validDeptIds.has(app.first_choice_dept_id) ? app.first_choice_dept_id : fallbackDeptId;
      if (targetDeptId) {
        db.prepare(`
          INSERT INTO assignments (
            id, application_id, department_id, ai_suggested_dept_id, ai_reason, status, confirmed_by, notified_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'Đã chốt phân công ban', 'confirmed', 'system', ?, ?, ?)
        `).run(crypto.randomUUID(), app.id, targetDeptId, targetDeptId, nowIso, nowIso, nowIso);
      }
    } else if (existing.status !== 'confirmed') {
      const targetDeptId = validDeptIds.has(existing.department_id)
        ? existing.department_id
        : validDeptIds.has(app.first_choice_dept_id)
        ? app.first_choice_dept_id
        : fallbackDeptId;
      db.prepare(`
        UPDATE assignments
        SET department_id = ?, status = 'confirmed', updated_at = ?
        WHERE id = ?
      `).run(targetDeptId, nowIso, existing.id);
    }
  }

  return departments.map((d) => {
    const assigned = db
      .prepare(`
        SELECT COUNT(*) as cnt
        FROM assignments a
        JOIN applications app ON app.id = a.application_id
        WHERE a.department_id = ?
          AND a.status = 'confirmed'
          AND app.status IN ('assigned', 'completed')
      `)
      .get(d.id) as { cnt: number };

    const assignedCount = assigned.cnt;
    const remainingQuota = Math.max(0, d.quota - assignedCount);

    return {
      ...d,
      assigned_count: assignedCount,
      remaining_quota: remainingQuota,
      assignedCount,
      remainingQuota,
    };
  });
}

apiRouter.get('/rounds/current', (_req: Request, res: Response) => {
  const round = db
    .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
    .get() as RecruitmentRound | undefined;

  if (!round) {
    return res.status(404).json({ error: 'Chưa có đợt tuyển nào được khởi tạo.' });
  }

  const departments = syncAndGetDepartmentsWithQuotas(round.id);

  const criteria = db
    .prepare('SELECT * FROM scoring_criteria WHERE round_id = ? ORDER BY weight DESC')
    .all(round.id) as ScoringCriterion[];

  return res.json({
    round,
    departments,
    criteria,
    systemNow: getSystemNowIso(),
    timeScale: Number(getSetting('TIME_SCALE', '1')) || 1,
  });
});

// ============================================================================
// 3. CANDIDATE APPLICATION ENDPOINTS
// ============================================================================

apiRouter.get('/applications/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const app = db
    .prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(req.user!.id) as Application | undefined;

  if (!app) {
    return res.json({ application: null, auditLogs: [], notifications: [] });
  }

  const enriched = enrichApplication(app);
  const auditLogs = db
    .prepare('SELECT * FROM audit_logs WHERE application_id = ? ORDER BY created_at DESC')
    .all(app.id);
  const notifications = db
    .prepare('SELECT * FROM notifications WHERE application_id = ? ORDER BY created_at DESC')
    .all(app.id);

  return res.json({
    application: enriched,
    auditLogs,
    notifications,
    systemNow: getSystemNowIso(),
  });
});

apiRouter.post('/applications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db
    .prepare('SELECT id FROM applications WHERE user_id = ?')
    .get(req.user!.id) as { id: string } | undefined;

  if (existing) {
    return res.status(400).json({
      error: 'Bạn đã nộp hồ sơ trong đợt tuyển này rồi. Vui lòng theo dõi tại mục "Hồ sơ của tôi".',
    });
  }

  const round = db
    .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
    .get() as RecruitmentRound | undefined;

  if (!round || round.status !== 'open') {
    return res.status(400).json({ error: 'Đợt tuyển hiện đã đóng hoặc chưa mở đơn.' });
  }

  const now = getSystemNow();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const openMs = Date.parse(round.open_at);
  const closeMs = Date.parse(round.close_at);

  if (!Number.isNaN(openMs) && nowMs < openMs) {
    return res.status(400).json({
      error: `Đợt tuyển chưa đến thời gian mở đơn (mở lúc ${new Date(openMs).toLocaleString('vi-VN')}).`,
    });
  }
  if (!Number.isNaN(closeMs) && nowMs > closeMs) {
    return res.status(400).json({
      error: `Đợt tuyển đã quá thời hạn nhận hồ sơ (đóng lúc ${new Date(closeMs).toLocaleString('vi-VN')}).`,
    });
  }

  const body = req.body || {};
  const id = crypto.randomUUID();

  const fullName = sanitizeText(body.full_name ?? req.user!.full_name);
  const studentId = sanitizeText(body.student_id);
  const className = sanitizeText(body.class_name);
  const email = sanitizeText(body.email ?? req.user!.email);
  const phone = sanitizeText(body.phone);
  const firstChoice = sanitizeText(body.first_choice_dept_id);
  const secondChoice = sanitizeText(body.second_choice_dept_id);
  const experience = sanitizeText(body.experience);
  const essay = sanitizeText(body.essay);
  const cvUrl = sanitizeText(body.cv_url);
  const commitmentConfirmed = body.commitment_confirmed === false ? 0 : 1;
  const isActiveStudent = body.is_active_student === false ? 0 : 1;

  db.prepare(`
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
  `).run(
    id,
    round.id,
    req.user!.id,
    fullName,
    studentId,
    className,
    email,
    phone,
    firstChoice,
    secondChoice,
    experience,
    essay,
    cvUrl,
    commitmentConfirmed,
    isActiveStudent,
    nowIso,
    nowIso,
    nowIso
  );

  writeAuditLog({
    applicationId: id,
    actor: `user:${req.user!.id}`,
    action: 'SUBMIT_APPLICATION',
    ruleApplied: 'Candidate Form Submission -> Start Case',
    inputSnapshot: {
      full_name: fullName,
      student_id: studentId,
      class_name: className,
      first_choice_dept_id: firstChoice,
    },
    result: 'Ứng viên đã nộp đơn đăng ký CTV.',
    createdAt: nowIso,
  });

  // Immediately run automated check & screening pipeline (Steps 2 -> 3 -> 4 -> 7)
  const processed = runAutomatedCheckAndScreenPipeline(id, 'system');

  return res.status(201).json({
    application: enrichApplication(processed),
  });
});

// Step 3 Subprocess: Candidate submits supplement fields
const handleSupplementSubmission = (req: AuthenticatedRequest, res: Response) => {
  const app = db
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(req.params.id) as Application | undefined;

  if (!app) {
    return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
  }
  if (req.user!.role === 'candidate' && app.user_id !== req.user!.id) {
    return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa hồ sơ của người khác.' });
  }
  if (app.status !== 'needs_supplement') {
    return res.status(400).json({ error: 'Hồ sơ hiện không ở trạng thái chờ bổ sung thông tin.' });
  }

  const round = db
    .prepare('SELECT * FROM recruitment_rounds WHERE id = ?')
    .get(app.round_id) as RecruitmentRound;

  const now = getSystemNow();
  const nowIso = now.toISOString();

  // Check if 2-day timer already expired before submission
  if (app.supplement_deadline_at && now.getTime() > new Date(app.supplement_deadline_at).getTime()) {
    runTimerTick(false);
    return res.status(400).json({
      error: 'Đã quá thời hạn 2 ngày bổ sung hồ sơ. Hồ sơ đã bị đóng tự động.',
    });
  }

  const body = req.body || {};
  const newSupplementCount = app.supplement_count + 1;

  const updatedFields = {
    full_name: body.full_name !== undefined ? sanitizeText(body.full_name) : app.full_name,
    student_id: body.student_id !== undefined ? sanitizeText(body.student_id) : app.student_id,
    class_name: body.class_name !== undefined ? sanitizeText(body.class_name) : app.class_name,
    email: body.email !== undefined ? sanitizeText(body.email) : app.email,
    phone: body.phone !== undefined ? sanitizeText(body.phone) : app.phone,
    first_choice_dept_id:
      body.first_choice_dept_id !== undefined ? sanitizeText(body.first_choice_dept_id) : app.first_choice_dept_id,
    second_choice_dept_id:
      body.second_choice_dept_id !== undefined ? sanitizeText(body.second_choice_dept_id) : app.second_choice_dept_id,
    experience: body.experience !== undefined ? sanitizeText(body.experience) : app.experience,
    essay: body.essay !== undefined ? sanitizeText(body.essay) : app.essay,
    cv_url: body.cv_url !== undefined ? sanitizeText(body.cv_url) : app.cv_url,
  };

  transition({
    applicationId: app.id,
    nextStatus: 'supplement_submitted',
    actor: `user:${req.user!.id}`,
    action: 'SUBMIT_SUPPLEMENT',
    ruleApplied: `Subprocess Bổ sung hồ sơ (Lần ${newSupplementCount}/${round.supplement_max_rounds})`,
    inputSnapshot: {
      supplementRound: newSupplementCount,
      updatedFields,
    },
    resultText: `Ứng viên đã gửi thông tin bổ sung lần ${newSupplementCount}/${round.supplement_max_rounds}.`,
    extraColumns: {
      ...updatedFields,
      supplement_count: newSupplementCount,
    },
    timestampIso: nowIso,
  });

  // Re-check supplemented application automatically
  const processed = runAutomatedCheckAndScreenPipeline(app.id, 'system');
  return res.json({
    application: enrichApplication(processed),
  });
};

apiRouter.post('/applications/:id/supplement', requireAuth, handleSupplementSubmission);
apiRouter.put('/applications/:id/supplement', requireAuth, handleSupplementSubmission);

// Global Withdraw Exception
apiRouter.post('/applications/:id/withdraw', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const app = db
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(req.params.id) as Application | undefined;

  if (!app) {
    return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
  }
  if (req.user!.role === 'candidate' && app.user_id !== req.user!.id) {
    return res.status(403).json({ error: 'Bạn chỉ có thể rút hồ sơ của chính mình.' });
  }

  const reason = sanitizeText(req.body?.reason) || 'Ứng viên chủ động rút đơn cá nhân';
  try {
    const updated = withdrawApplication(app.id, reason, `user:${req.user!.id}`);
    const enriched = enrichApplication(updated);
    return res.json({
      application: enriched,
      quotaRestored: enriched.assignment?.status === 'revoked',
    });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Lỗi khi rút đơn' });
  }
});

// ============================================================================
// 4. HR SPREADSHEET & REVIEW QUEUES
// ============================================================================

apiRouter.get(
  '/applications',
  requireAuth,
  requireRole('hr', 'board', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const { status, deptId, search, minScore, maxScore, sortBy, sortDir } = req.query;

    let sql = 'SELECT * FROM applications WHERE 1=1';
    const params: unknown[] = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(String(status));
    }
    if (deptId && deptId !== 'all') {
      sql += ' AND (first_choice_dept_id = ? OR second_choice_dept_id = ?)';
      params.push(String(deptId), String(deptId));
    }
    if (minScore !== undefined && minScore !== '') {
      sql += ' AND screening_score >= ?';
      params.push(Number(minScore));
    }
    if (maxScore !== undefined && maxScore !== '') {
      sql += ' AND screening_score <= ?';
      params.push(Number(maxScore));
    }
    if (search && String(search).trim() !== '') {
      const q = `%${String(search).trim()}%`;
      sql += ' AND (full_name LIKE ? OR student_id LIKE ? OR email LIKE ? OR class_name LIKE ? OR phone LIKE ?)';
      params.push(q, q, q, q, q);
    }

    const allowedSortCols: Record<string, string> = {
      submitted_at: 'submitted_at',
      screening_score: 'screening_score',
      full_name: 'full_name',
      status: 'status',
      student_id: 'student_id',
    };
    const col = allowedSortCols[String(sortBy)] || 'submitted_at';
    const dir = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${col} ${dir}`;

    const rows = db.prepare(sql).all(...params) as Application[];
    const enriched = rows.map(enrichApplication);

    return res.json({ applications: enriched, total: enriched.length });
  }
);

apiRouter.get(
  '/applications/:id',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const app = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.id) as Application | undefined;

    if (!app) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
    }
    if (req.user!.role === 'candidate' && app.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Không có quyền xem hồ sơ này.' });
    }

    const enriched = enrichApplication(app);
    const auditLogs = db
      .prepare('SELECT * FROM audit_logs WHERE application_id = ? ORDER BY created_at DESC')
      .all(app.id);
    const notifications = db
      .prepare('SELECT * FROM notifications WHERE application_id = ? ORDER BY created_at DESC')
      .all(app.id);

    return res.json({
      application: enriched,
      auditLogs,
      notifications,
    });
  }
);

// Step 5: HR manual review on 'needs_review' applications
const reviewSchema = z.object({
  decision: z.enum(['pass', 'fail']),
  reason: z.string().min(3, 'Vui lòng nhập lý do duyệt (tối thiểu 3 ký tự)'),
});

apiRouter.post(
  '/applications/:id/review',
  requireAuth,
  requireRole('hr', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' });
    }

    const app = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.id) as Application | undefined;

    if (!app) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
    }
    if (app.status !== 'needs_review') {
      return res.status(400).json({ error: 'Hồ sơ này không nằm trong hàng đợi Cần xem xét.' });
    }

    const { decision, reason } = parsed.data;
    const nowIso = getSystemNowIso();

    db.prepare(`
      INSERT INTO review_decisions (id, application_id, reviewer_id, decision, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), app.id, req.user!.id, decision, sanitizeText(reason), nowIso, nowIso);

    if (decision === 'pass') {
      transition({
        applicationId: app.id,
        nextStatus: 'review_pass',
        actor: `user:${req.user!.id}`,
        action: 'HR_MANUAL_REVIEW_PASS',
        ruleApplied: 'Manual Review on Needs-Review Branch -> Pass',
        inputSnapshot: { decision, reason, reviewer: req.user!.full_name },
        resultText: `HR (${req.user!.full_name}) duyệt ĐẠT vòng hồ sơ. Lý do: ${reason}`,
        timestampIso: nowIso,
      });

      const invited = sendInterviewBookingInvitation(app.id, `user:${req.user!.id}`, nowIso);
      return res.json({ application: enrichApplication(invited) });
    } else {
      transition({
        applicationId: app.id,
        nextStatus: 'review_fail',
        actor: `user:${req.user!.id}`,
        action: 'HR_MANUAL_REVIEW_FAIL',
        ruleApplied: 'Manual Review on Needs-Review Branch -> Fail',
        inputSnapshot: { decision, reason, reviewer: req.user!.full_name },
        resultText: `HR (${req.user!.full_name}) duyệt KHÔNG ĐẠT vòng hồ sơ. Lý do: ${reason}`,
        timestampIso: nowIso,
      });

      const rejected = transition({
        applicationId: app.id,
        nextStatus: 'rejected_docs',
        actor: 'system',
        action: 'SEND_DOCS_REJECTED_NOTIFICATION',
        ruleApplied: 'Gate Hồ sơ đạt? = Không đạt -> Gửi thông báo không đạt',
        inputSnapshot: { reason },
        resultText: `Đã gửi thông báo hồ sơ không đạt cho ứng viên (${reason}).`,
        endReason: 'rejected_docs',
        timestampIso: nowIso,
      });

      NotificationService.send({
        applicationId: app.id,
        toEmail: app.email,
        templateKey: 'docs_rejected',
        variables: {
          full_name: app.full_name,
          reason: sanitizeText(reason),
        },
        createdAt: nowIso,
      });

      return res.json({ application: enrichApplication(rejected) });
    }
  }
);

// Step 6: HR confirms near-threshold 'clear_fail' rejection (or rescues to pass)
apiRouter.post(
  '/applications/:id/confirm-reject',
  requireAuth,
  requireRole('hr', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const app = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.id) as Application | undefined;

    if (!app) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
    }
    if (app.status !== 'clear_fail' && app.status !== 'rejected_docs') {
      return res.status(400).json({ error: 'Hồ sơ không ở trạng thái Loại rõ / Chờ xác nhận.' });
    }

    const actionType = req.body?.action === 'rescue_pass' ? 'rescue_pass' : 'confirm_reject';
    const note = sanitizeText(req.body?.reason) || `Điểm sơ loại (${app.screening_score}đ) dưới ngưỡng tối thiểu Y`;
    const nowIso = getSystemNowIso();

    if (actionType === 'rescue_pass') {
      transition({
        applicationId: app.id,
        nextStatus: 'review_pass',
        actor: `user:${req.user!.id}`,
        action: 'HR_RESCUE_NEAR_THRESHOLD',
        ruleApplied: 'HR Review Near-Threshold Queue -> Override to Pass',
        inputSnapshot: { screeningScore: app.screening_score, note },
        resultText: `HR (${req.user!.full_name}) quyết định cứu hồ sơ gần ngưỡng sang ĐẠT (${note}).`,
        timestampIso: nowIso,
      });
      const invited = sendInterviewBookingInvitation(app.id, `user:${req.user!.id}`, nowIso);
      return res.json({ application: enrichApplication(invited) });
    }

    const rejected = transition({
      applicationId: app.id,
      nextStatus: 'rejected_docs',
      actor: `user:${req.user!.id}`,
      action: 'HR_CONFIRM_NEAR_THRESHOLD_REJECT',
      ruleApplied: 'Near-Threshold Safety Gate: HR Confirmed Rejection Notification',
      inputSnapshot: { screeningScore: app.screening_score, note, confirmedBy: req.user!.full_name },
      resultText: `HR (${req.user!.full_name}) đã xác nhận loại hồ sơ gần ngưỡng và gửi thư thông báo.`,
      endReason: 'rejected_docs',
      timestampIso: nowIso,
    });

    NotificationService.send({
      applicationId: app.id,
      toEmail: app.email,
      templateKey: 'docs_rejected',
      variables: {
        full_name: app.full_name,
        reason: note,
      },
      createdAt: nowIso,
    });

    return res.json({ application: enrichApplication(rejected) });
  }
);

apiRouter.post(
  '/applications/batch-confirm-reject',
  requireAuth,
  requireRole('hr', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const ids: string[] = Array.isArray(req.body?.applicationIds) ? req.body.applicationIds : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 hồ sơ để xác nhận gửi.' });
    }

    const nowIso = getSystemNowIso();
    const processedIds: string[] = [];

    for (const id of ids) {
      const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Application | undefined;
      if (app && app.status === 'clear_fail') {
        const reason = `Điểm sơ loại (${app.screening_score}đ) thấp hơn ngưỡng Y`;
        transition({
          applicationId: app.id,
          nextStatus: 'rejected_docs',
          actor: `user:${req.user!.id}`,
          action: 'HR_BATCH_CONFIRM_NEAR_THRESHOLD_REJECT',
          ruleApplied: 'Near-Threshold Safety Gate: Batch HR Confirmation',
          inputSnapshot: { screeningScore: app.screening_score, confirmedBy: req.user!.full_name },
          resultText: `HR (${req.user!.full_name}) xác nhận hàng loạt gửi thông báo không đạt cho hồ sơ gần ngưỡng.`,
          endReason: 'rejected_docs',
          timestampIso: nowIso,
        });

        NotificationService.send({
          applicationId: app.id,
          toEmail: app.email,
          templateKey: 'docs_rejected',
          variables: {
            full_name: app.full_name,
            reason,
          },
          createdAt: nowIso,
        });
        processedIds.push(app.id);
      }
    }

    return res.json({ confirmedCount: processedIds.length, processedIds });
  }
);

// ============================================================================
// 5. INTERVIEW SLOTS, BOOKING, CHECK-IN & PARALLEL SCORECARDS
// ============================================================================

apiRouter.get('/slots', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const round = db
    .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
    .get() as RecruitmentRound | undefined;

  if (!round) {
    return res.json({ slots: [] });
  }

  const rawSlots = db
    .prepare('SELECT * FROM interview_slots WHERE round_id = ? ORDER BY start_at ASC')
    .all(round.id) as Array<{
    id: string;
    round_id: string;
    start_at: string;
    end_at: string;
    location_or_link: string;
    capacity: number;
    interviewer_ids: string;
  }>;

  const depts = db.prepare('SELECT id, name FROM departments WHERE round_id = ?').all(round.id) as Array<{
    id: string;
    name: string;
  }>;
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));
  const isCandidate = req.user!.role === 'candidate';

  const slots = rawSlots.map((s) => {
    const bookings = db
      .prepare(`
        SELECT
          b.id as booking_id,
          b.application_id,
          b.checked_in_at,
          a.user_id,
          a.full_name,
          a.student_id,
          a.first_choice_dept_id,
          a.status,
          (SELECT COUNT(*) FROM scorecards sc WHERE sc.application_id = a.id) as scorecard_count
        FROM interview_bookings b
        JOIN applications a ON a.id = b.application_id
        WHERE b.slot_id = ? AND a.status != 'withdrawn'
        ORDER BY b.booked_at ASC
      `)
      .all(s.id) as Array<{
      booking_id: string;
      application_id: string;
      checked_in_at: string | null;
      user_id: string;
      full_name: string;
      student_id: string;
      first_choice_dept_id: string;
      status: Application['status'];
      scorecard_count: number;
    }>;

    // F07 Fix: Candidates only receive their own booking (if any) and aggregate booked_count/capacity.
    // Internal staff (hr, board, admin) receive full booking details.
    const visibleBookings = isCandidate
      ? bookings.filter((b) => b.user_id === req.user!.id)
      : bookings;

    return {
      ...s,
      interviewer_ids: JSON.parse(s.interviewer_ids || '[]'),
      booked_count: bookings.length,
      bookings: visibleBookings.map(({ user_id: _uid, ...b }) => ({
        ...b,
        first_choice_name: deptMap.get(b.first_choice_dept_id) || '',
      })),
    };
  });

  return res.json({ slots, systemNow: getSystemNowIso() });
});

function parseSlotDateTime(value: string): Date | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  // If datetime-local format without timezone offset (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss),
  // interpret in Vietnam timezone (+07:00) for consistent behavior across client and server.
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  const normalized = hasTimezone ? trimmed : `${trimmed.length === 16 ? `${trimmed}:00` : trimmed}+07:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

const createSlotSchema = z.object({
  start_at: z.string().min(10, 'Thời gian bắt đầu không hợp lệ'),
  end_at: z.string().min(10, 'Thời gian kết thúc không hợp lệ'),
  location_or_link: z.string().min(3, 'Vui lòng nhập phòng hoặc link phỏng vấn'),
  capacity: z.number().int().min(1, 'Sức chứa tối thiểu là 1').max(50, 'Sức chứa tối đa là 50'),
  interviewer_ids: z.array(z.string()).optional(),
});

apiRouter.post(
  '/slots',
  requireAuth,
  requireRole('board', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const parsed = createSlotSchema.safeParse({
      ...req.body,
      capacity: Number(req.body?.capacity),
    });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu khung giờ không hợp lệ' });
    }

    const { start_at, end_at, location_or_link, capacity, interviewer_ids } = parsed.data;
    const startDate = parseSlotDateTime(start_at);
    const endDate = parseSlotDateTime(end_at);

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Định dạng thời gian bắt đầu hoặc kết thúc không hợp lệ.' });
    }
    if (endDate.getTime() <= startDate.getTime()) {
      return res.status(400).json({
        error: 'Thời gian kết thúc ca phỏng vấn phải sau thời gian bắt đầu.',
      });
    }

    const round = db
      .prepare('SELECT id FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
      .get() as { id: string };

    const id = crypto.randomUUID();
    const nowIso = getSystemNowIso();

    db.prepare(`
      INSERT INTO interview_slots (id, round_id, start_at, end_at, location_or_link, capacity, interviewer_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      round.id,
      startDate.toISOString(),
      endDate.toISOString(),
      sanitizeText(location_or_link),
      capacity,
      JSON.stringify(interviewer_ids || [req.user!.id]),
      nowIso,
      nowIso
    );

    writeAuditLog({
      applicationId: null,
      actor: `user:${req.user!.id}`,
      action: 'CREATE_INTERVIEW_SLOT',
      ruleApplied: 'BCN Slot Management (Validated end_at > start_at)',
      inputSnapshot: {
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        location_or_link,
        capacity,
      },
      result: `BCN (${req.user!.full_name}) đã tạo khung giờ phỏng vấn tại ${location_or_link} (Sức chứa: ${capacity}).`,
      createdAt: nowIso,
    });

    const createdSlot = {
      id,
      round_id: round.id,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      location_or_link: sanitizeText(location_or_link),
      capacity,
    };

    return res.status(201).json({
      ...createdSlot,
      slot: createdSlot,
    });
  }
);

// Step 8: Candidate books or changes interview slot
apiRouter.post('/applications/:id/book', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { slotId } = req.body || {};
  if (!slotId) {
    return res.status(400).json({ error: 'Vui lòng chọn một khung giờ phỏng vấn.' });
  }

  const app = db
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(req.params.id) as Application | undefined;

  if (!app) {
    return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
  }
  if (req.user!.role === 'candidate' && app.user_id !== req.user!.id) {
    return res.status(403).json({ error: 'Bạn chỉ được đặt lịch cho hồ sơ của chính mình.' });
  }
  if (app.status !== 'invited_to_book' && app.status !== 'booked') {
    return res.status(400).json({ error: 'Hồ sơ hiện không ở bước đặt lịch phỏng vấn.' });
  }

  const now = getSystemNow();
  const nowIso = now.toISOString();

  // F06 Fix: Enforce 2-day booking deadline directly in the booking API even if background timer hasn't run yet
  if (app.status === 'invited_to_book' && shouldDrop(app, now.getTime())) {
    runTimerTick(false);
    return res.status(400).json({
      error: 'Đã quá thời hạn 2 ngày đặt lịch phỏng vấn. Hồ sơ đã kết thúc ở trạng thái "Ứng viên không tham gia".',
    });
  }

  const slot = db
    .prepare('SELECT * FROM interview_slots WHERE id = ?')
    .get(slotId) as { id: string; capacity: number; start_at: string; end_at: string; location_or_link: string } | undefined;

  if (!slot) {
    return res.status(404).json({ error: 'Khung giờ phỏng vấn không tồn tại.' });
  }

  const bookedCntRow = db
    .prepare(`
      SELECT COUNT(*) as cnt
      FROM interview_bookings b
      JOIN applications a ON a.id = b.application_id
      WHERE b.slot_id = ? AND a.status != 'withdrawn'
    `)
    .get(slot.id) as { cnt: number };

  const existingBooking = db
    .prepare('SELECT * FROM interview_bookings WHERE application_id = ?')
    .get(app.id) as { id: string; slot_id: string; checked_in_at: string | null } | undefined;

  if (existingBooking?.checked_in_at) {
    return res.status(400).json({ error: 'Bạn đã check-in phỏng vấn nên không thể đổi khung giờ.' });
  }

  const check = canBook(
    {
      id: slot.id,
      capacity: slot.capacity,
      booked_count: bookedCntRow.cnt,
      start_at: slot.start_at,
    },
    existingBooking?.slot_id || null,
    nowIso
  );

  if (!check.allowed) {
    return res.status(400).json({ error: check.reason });
  }

  if (existingBooking) {
    db.prepare(`
      UPDATE interview_bookings
      SET slot_id = ?, booked_at = ?, updated_at = ?
      WHERE id = ?
    `).run(slot.id, nowIso, nowIso, existingBooking.id);
  } else {
    db.prepare(`
      INSERT INTO interview_bookings (id, application_id, slot_id, booked_at, checked_in_at, no_show, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 0, ?, ?)
    `).run(crypto.randomUUID(), app.id, slot.id, nowIso, nowIso, nowIso);
  }

  const updated = transition({
    applicationId: app.id,
    nextStatus: 'booked',
    actor: `user:${req.user!.id}`,
    action: existingBooking ? 'RESCHEDULE_INTERVIEW_SLOT' : 'BOOK_INTERVIEW_SLOT',
    ruleApplied: `canBook(slot=${slot.id}, booked=${bookedCntRow.cnt}/${slot.capacity}) -> Cancel 1d/2d unbooked timers`,
    inputSnapshot: {
      slotId: slot.id,
      startAt: slot.start_at,
      location: slot.location_or_link,
    },
    resultText: `Đã đặt lịch phỏng vấn thành công (${new Date(slot.start_at).toLocaleString('vi-VN')} - ${slot.location_or_link}).`,
    extraColumns: {
      schedule_deadline_at: null,
    },
    timestampIso: nowIso,
  });

  return res.json({ application: enrichApplication(updated) });
});

// Step 9a (AND branch 1): Candidate Check-in at Interview
apiRouter.post('/applications/:id/check-in', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const app = db
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(req.params.id) as Application | undefined;

  if (!app) {
    return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
  }
  if (req.user!.role === 'candidate' && app.user_id !== req.user!.id) {
    return res.status(403).json({ error: 'Không có quyền check-in hồ sơ này.' });
  }
  if (app.status !== 'booked' && app.status !== 'interviewing') {
    return res.status(400).json({ error: 'Hồ sơ chưa đặt lịch hoặc đã qua bước phỏng vấn.' });
  }

  const booking = db
    .prepare('SELECT * FROM interview_bookings WHERE application_id = ?')
    .get(app.id) as { id: string; checked_in_at: string | null } | undefined;

  if (!booking) {
    return res.status(400).json({ error: 'Chưa có thông tin đặt lịch phỏng vấn.' });
  }

  const nowIso = getSystemNowIso();
  db.prepare('UPDATE interview_bookings SET checked_in_at = ?, updated_at = ? WHERE id = ?').run(
    nowIso,
    nowIso,
    booking.id
  );

  const checkInActorDesc =
    req.user!.role === 'candidate'
      ? `Ứng viên ${app.full_name} tự check-in tại buổi phỏng vấn.`
      : `${req.user!.full_name} (${req.user!.role.toUpperCase()}) điểm danh xác nhận có mặt cho ứng viên ${app.full_name}.`;

  writeAuditLog({
    applicationId: app.id,
    actor: `user:${req.user!.id}`,
    action: 'INTERVIEW_CHECK_IN',
    ruleApplied: 'AND-split Branch 1: Candidate Check-in Recorded Explicitly',
    inputSnapshot: {
      bookingId: booking.id,
      checkedInAt: nowIso,
      recordedByRole: req.user!.role,
      recordedByName: req.user!.full_name,
    },
    result: checkInActorDesc,
    createdAt: nowIso,
  });

  const converged = evaluateInterviewAndJoin(app.id, `user:${req.user!.id}`);
  return res.json({ application: enrichApplication(converged) });
});

// Step 9b (AND branch 2): Board Submits Scorecard
apiRouter.post(
  '/applications/:id/scorecards',
  requireAuth,
  requireRole('board', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const app = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.id) as Application | undefined;

    if (!app) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ ứng viên.' });
    }
    if (
      ![
        'booked',
        'interviewing',
        'scored',
        'decided_pass',
        'decided_fail',
      ].includes(app.status)
    ) {
      return res.status(400).json({
        error: 'Hồ sơ này chưa đặt lịch phỏng vấn hoặc đã kết thúc giai đoạn chấm điểm phỏng vấn.',
      });
    }

    const { scores, comment, decision } = req.body || {};
    if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
      return res.status(400).json({ error: 'Vui lòng nhập điểm cho các tiêu chí.' });
    }

    const round = db
      .prepare('SELECT * FROM recruitment_rounds WHERE id = ?')
      .get(app.round_id) as RecruitmentRound;
    const criteria = db
      .prepare('SELECT id, name, weight, max_score FROM scoring_criteria WHERE round_id = ?')
      .all(app.round_id) as Array<{ id: string; name: string; weight: number; max_score: number }>;

    const sanitizedScores: Record<string, number> = {};
    for (const crit of criteria) {
      const rawVal = (scores as Record<string, unknown>)[crit.id];
      if (rawVal === undefined || rawVal === null || rawVal === '') {
        return res.status(400).json({ error: `Thiếu điểm cho tiêu chí "${crit.name}".` });
      }
      const numVal = Number(rawVal);
      if (!Number.isFinite(numVal) || numVal < 0 || numVal > crit.max_score) {
        return res.status(400).json({
          error: `Điểm của tiêu chí "${crit.name}" phải nằm trong khoảng từ 0 đến ${crit.max_score}.`,
        });
      }
      sanitizedScores[crit.id] = numVal;
    }

    const existingBooking = db
      .prepare('SELECT id, checked_in_at FROM interview_bookings WHERE application_id = ?')
      .get(app.id) as { id: string; checked_in_at: string | null } | undefined;

    if (!existingBooking) {
      return res.status(400).json({ error: 'Ứng viên chưa đặt ca phỏng vấn.' });
    }

    // F10 Fix: Do NOT auto-check-in when submitting a scorecard!
    // If BCN wants to immediately decide ('pass' | 'fail' | 'waitlist') in the same request,
    // the candidate MUST have already checked in.
    if (decision && ['pass', 'fail', 'waitlist'].includes(decision) && !existingBooking.checked_in_at) {
      return res.status(400).json({
        error: 'Ứng viên chưa được điểm danh (Check-in) nên chưa thể chốt kết quả Đậu/Rớt. Vui lòng bấm Check-in trước hoặc chỉ lưu phiếu điểm.',
      });
    }

    const nowIso = getSystemNowIso();

    const existing = db
      .prepare('SELECT id FROM scorecards WHERE application_id = ? AND interviewer_id = ?')
      .get(app.id, req.user!.id) as { id: string } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE scorecards
        SET scores = ?, comment = ?, submitted_at = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(sanitizedScores), sanitizeText(comment), nowIso, nowIso, existing.id);
    } else {
      db.prepare(`
        INSERT INTO scorecards (id, application_id, interviewer_id, scores, comment, submitted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        app.id,
        req.user!.id,
        JSON.stringify(sanitizedScores),
        sanitizeText(comment),
        nowIso,
        nowIso,
        nowIso
      );
    }

    writeAuditLog({
      applicationId: app.id,
      actor: `user:${req.user!.id}`,
      action: 'SUBMIT_SCORECARD',
      ruleApplied: 'AND-split Branch 2: Subprocess Phỏng vấn và chấm điểm (Independent of Check-in)',
      inputSnapshot: { interviewer: req.user!.full_name, scores: sanitizedScores, comment },
      result: `Giám khảo ${req.user!.full_name} đã nộp phiếu chấm điểm phỏng vấn.`,
      createdAt: nowIso,
    });

    let converged = evaluateInterviewAndJoin(app.id, `user:${req.user!.id}`);

    // If BCN also selected a decision ('pass' | 'fail' | 'waitlist') right in the scorecard modal
    if (decision && ['pass', 'fail', 'waitlist'].includes(decision)) {
      const scorecardsRows = db
        .prepare('SELECT scores FROM scorecards WHERE application_id = ?')
        .all(app.id) as Array<{ scores: string }>;

      if (
        !canConvergeInterviewAndJoin(
          existingBooking.checked_in_at,
          scorecardsRows.length,
          round.min_scorecards_per_interview
        )
      ) {
        return res.status(400).json({
          error: `Chưa đủ điều kiện hội tụ phỏng vấn (Cần Check-in và tối thiểu ${round.min_scorecards_per_interview} phiếu chấm điểm).`,
        });
      }

      // F04 Fix: Preserve 0 score when scorecards exist
      const totalScore = computeTotalScore(
        scorecardsRows.map((s) => ({ scores: JSON.parse(s.scores || '{}') })),
        criteria
      );

      db.prepare(`
        INSERT INTO selection_decisions (id, application_id, total_score, decision, decided_by, note, notified_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
        ON CONFLICT(application_id) DO UPDATE SET
          total_score = excluded.total_score,
          decision = excluded.decision,
          decided_by = excluded.decided_by,
          note = excluded.note,
          updated_at = excluded.updated_at
      `).run(
        crypto.randomUUID(),
        app.id,
        totalScore,
        decision,
        req.user!.id,
        sanitizeText(comment) || (decision === 'pass' ? 'BCN chấm điểm và duyệt Đậu' : 'BCN chấm điểm và xét Loại'),
        nowIso,
        nowIso
      );

      const nextStatus =
        decision === 'pass' ? 'decided_pass' : decision === 'fail' ? 'decided_fail' : 'scored';

      converged = transition({
        applicationId: app.id,
        nextStatus,
        actor: `user:${req.user!.id}`,
        action: 'BCN_SELECT_DECISION',
        ruleApplied: 'BCN Graded & Decided Immediately (After AND-join Convergence)',
        inputSnapshot: { decision, totalScore, decidedBy: req.user!.full_name },
        resultText: `BCN (${req.user!.full_name}) chấm điểm (${totalScore}đ) và chọn kết quả: ${
          decision === 'pass' ? 'ĐÃ ĐẬU (Chờ chốt gửi TB)' : decision === 'waitlist' ? 'CHỜ XÉT / DỰ BỊ' : 'ĐÃ LOẠI (Chờ chốt gửi TB)'
        }.`,
        endReason: null,
        extraColumns: { end_reason: null, finished_at: null },
        timestampIso: nowIso,
      });
    }

    const enriched = enrichApplication(converged);
    const computedTotalScore = computeTotalScore(
      (enriched.scorecards || []).map((s: { scores: Record<string, number> }) => ({ scores: s.scores })),
      criteria
    );

    return res.json({ application: enriched, computedTotalScore });
  }
);

// ============================================================================
// 6. BCN SELECTION SUMMARY, HUMAN DECISION & FINALIZE-AND-NOTIFY
// ============================================================================

apiRouter.get(
  '/selection/summary',
  requireAuth,
  requireRole('board', 'hr', 'admin'),
  (_req: AuthenticatedRequest, res: Response) => {
    const round = db
      .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
      .get() as RecruitmentRound;

    const criteria = db
      .prepare('SELECT * FROM scoring_criteria WHERE round_id = ? ORDER BY weight DESC')
      .all(round.id) as ScoringCriterion[];

    const departments = syncAndGetDepartmentsWithQuotas(round.id);

    const interviewApps = db
      .prepare(`
        SELECT * FROM applications
        WHERE round_id = ?
          AND status IN ('booked','interviewing','scored','decided_pass','decided_fail','offer_sent','failed_interview','confirmed_joined','assigned','completed')
      `)
      .all(round.id) as Application[];

    const enrichedList = interviewApps.map((app) => {
      const enriched = enrichApplication(app);
      const hasScorecards = Boolean(enriched.scorecards && enriched.scorecards.length > 0);
      const computedWeightedScore = hasScorecards
        ? computeTotalScore(enriched.scorecards || [], criteria)
        : null;
      // F04 Fix: Preserve 0 interview score when scorecards exist; never replace 0 with screening_score!
      const resolvedTotalScore =
        computedWeightedScore !== null
          ? computedWeightedScore
          : enriched.selection_decision?.total_score ?? null;
      return {
        ...enriched,
        computed_total_score: resolvedTotalScore,
      };
    });

    enrichedList.sort((a, b) => (b.computed_total_score ?? -1) - (a.computed_total_score ?? -1));

    return res.json({
      candidates: enrichedList,
      criteria,
      departments,
      minScorecards: round.min_scorecards_per_interview,
    });
  }
);

// Step 10: BCN decides Pass / Waitlist / Fail (F02, F04, F10 Fixed)
const selectionDecideSchema = z.object({
  decision: z.enum(['pass', 'waitlist', 'fail']),
  note: z.string().optional(),
});

apiRouter.post(
  '/selection/:applicationId/decide',
  requireAuth,
  requireRole('board', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const parsed = selectionDecideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Quyết định xét tuyển không hợp lệ.' });
    }

    const app = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.applicationId) as Application | undefined;

    if (!app) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ ứng viên.' });
    }

    // F02 Fix: Only allow deciding on applications in the interview scoring / pre-finalization stage.
    // Strictly reject applications in pre-interview, post-offer, or terminal/withdrawn statuses.
    const eligibleStatuses: Application['status'][] = [
      'booked',
      'interviewing',
      'scored',
      'decided_pass',
      'decided_fail',
    ];
    if (!eligibleStatuses.includes(app.status)) {
      return res.status(400).json({
        error: `Không thể ra quyết định xét tuyển cho hồ sơ đang ở trạng thái "${app.status}".`,
      });
    }

    const round = db
      .prepare('SELECT * FROM recruitment_rounds WHERE id = ?')
      .get(app.round_id) as RecruitmentRound;

    const existingBooking = db
      .prepare('SELECT id, checked_in_at FROM interview_bookings WHERE application_id = ?')
      .get(app.id) as { id: string; checked_in_at: string | null } | undefined;

    const scorecardsRows = db
      .prepare('SELECT scores FROM scorecards WHERE application_id = ?')
      .all(app.id) as Array<{ scores: string }>;

    // F02 & F10 Fix: Require explicit check-in AND minimum scorecards before BCN can decide Pass/Fail
    if (
      !canConvergeInterviewAndJoin(
        existingBooking?.checked_in_at,
        scorecardsRows.length,
        round.min_scorecards_per_interview
      )
    ) {
      return res.status(400).json({
        error: `Ứng viên chưa check-in hoặc chưa đủ tối thiểu ${round.min_scorecards_per_interview} phiếu chấm điểm phỏng vấn để ra quyết định.`,
      });
    }

    // Ensure application has converged to 'scored' if it was still in 'booked'/'interviewing'
    if (app.status === 'booked' || app.status === 'interviewing') {
      evaluateInterviewAndJoin(app.id, 'system');
    }

    const criteria = db
      .prepare('SELECT id, weight, max_score FROM scoring_criteria WHERE round_id = ?')
      .all(app.round_id) as Array<{ id: string; weight: number; max_score: number }>;

    // F04 Fix: Preserve 0 score when scorecards have all-zero scores; never replace 0 with screening_score!
    const totalScore = computeTotalScore(
      scorecardsRows.map((s) => ({ scores: JSON.parse(s.scores || '{}') })),
      criteria
    );

    const { decision, note } = parsed.data;
    const nowIso = getSystemNowIso();
    const nextStatus: Application['status'] =
      decision === 'pass' ? 'decided_pass' : decision === 'fail' ? 'decided_fail' : 'scored';

    const updatedApp = db.transaction(() => {
      db.prepare(`
        INSERT INTO selection_decisions (id, application_id, total_score, decision, decided_by, note, notified_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
        ON CONFLICT(application_id) DO UPDATE SET
          total_score = excluded.total_score,
          decision = excluded.decision,
          decided_by = excluded.decided_by,
          note = excluded.note,
          updated_at = excluded.updated_at
      `).run(
        crypto.randomUUID(),
        app.id,
        totalScore,
        decision,
        req.user!.id,
        sanitizeText(note) ||
          (decision === 'pass'
            ? 'BCN xét chọn Đậu phỏng vấn'
            : decision === 'waitlist'
            ? 'Đưa vào danh sách Chờ xét / Dự bị'
            : 'BCN xét chọn Rớt phỏng vấn'),
        nowIso,
        nowIso
      );

      return transition({
        applicationId: app.id,
        nextStatus,
        actor: `user:${req.user!.id}`,
        action: 'BCN_SELECT_DECISION',
        ruleApplied: 'BCN Selection Decision (Validated Check-in + Scorecards + State Machine)',
        inputSnapshot: {
          previousStatus: app.status,
          nextStatus,
          decision,
          totalScore,
          note,
          decidedBy: req.user!.full_name,
        },
        resultText: `BCN (${req.user!.full_name}) quyết định kết quả phỏng vấn: ${
          decision === 'pass'
            ? 'ĐÃ ĐẬU (Chờ chốt gửi TB)'
            : decision === 'waitlist'
            ? 'CHỜ XÉT / DỰ BỊ'
            : 'ĐÃ LOẠI (Chờ chốt gửi TB)'
        } (Điểm phỏng vấn: ${totalScore}đ).`,
        endReason: null,
        extraColumns: { end_reason: null, finished_at: null },
        timestampIso: nowIso,
      });
    })();

    return res.json({ application: enrichApplication(updatedApp) });
  }
);

// Controlled status update endpoint with strict enum validation, role check & state machine enforcement (F03 Fixed)
apiRouter.put(
  '/applications/:id/status',
  requireAuth,
  requireRole('hr', 'board', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const app = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.id) as Application | undefined;

    if (!app) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ ứng viên.' });
    }

    const rawStatus = sanitizeText(req.body?.status);
    const note = sanitizeText(req.body?.note) || 'Cập nhật trạng thái hồ sơ';

    if (!rawStatus || !ALL_APPLICATION_STATUSES.includes(rawStatus as Application['status'])) {
      return res.status(400).json({
        error: `Trạng thái "${rawStatus || ''}" không tồn tại trong hệ thống.`,
      });
    }

    const nextStatus = rawStatus as Application['status'];

    // Role-based permission checks on status transitions (BTH 3.2):
    // HR is only allowed to transition document review states, NOT interview selection decisions.
    const interviewDecisionStates: Application['status'][] = [
      'scored',
      'decided_pass',
      'decided_fail',
      'offer_sent',
      'failed_interview',
    ];
    if (req.user!.role === 'hr' && interviewDecisionStates.includes(nextStatus)) {
      return res.status(403).json({
        error: 'Theo phân quyền BTH 3.2, chỉ Ban Chủ nhiệm (BCN) mới có quyền quyết định kết quả phỏng vấn.',
      });
    }

    const hrReviewStates: Application['status'][] = [
      'review_pass',
      'review_fail',
      'rejected_docs',
      'invited_to_book',
      'assigned',
      'completed',
    ];
    if (req.user!.role === 'board' && hrReviewStates.includes(nextStatus)) {
      return res.status(403).json({
        error: 'Thao tác duyệt hồ sơ và phân công ban thuộc thẩm quyền của Ban Nhân sự (BNS).',
      });
    }

    if (!isValidStateTransition(app.status, nextStatus)) {
      return res.status(400).json({
        error: `Chuyển trạng thái không hợp lệ từ "${app.status}" sang "${nextStatus}".`,
      });
    }

    const round = db
      .prepare('SELECT * FROM recruitment_rounds WHERE id = ?')
      .get(app.round_id) as RecruitmentRound;

    const existingBooking = db
      .prepare('SELECT id, checked_in_at FROM interview_bookings WHERE application_id = ?')
      .get(app.id) as { id: string; checked_in_at: string | null } | undefined;

    const scorecardsRows = db
      .prepare('SELECT scores FROM scorecards WHERE application_id = ?')
      .all(app.id) as Array<{ scores: string }>;

    if (
      ['scored', 'decided_pass', 'decided_fail'].includes(nextStatus) &&
      !canConvergeInterviewAndJoin(
        existingBooking?.checked_in_at,
        scorecardsRows.length,
        round.min_scorecards_per_interview
      )
    ) {
      return res.status(400).json({
        error: `Ứng viên chưa check-in hoặc chưa đủ tối thiểu ${round.min_scorecards_per_interview} phiếu chấm điểm.`,
      });
    }

    const nowIso = getSystemNowIso();
    const criteria = db
      .prepare('SELECT id, weight, max_score FROM scoring_criteria WHERE round_id = ?')
      .all(app.round_id) as Array<{ id: string; weight: number; max_score: number }>;

    const hasScorecards = scorecardsRows.length > 0;
    const computedScore = hasScorecards
      ? computeTotalScore(
          scorecardsRows.map((s) => ({ scores: JSON.parse(s.scores || '{}') })),
          criteria
        )
      : app.screening_score ?? 0;

    if (nextStatus === 'assigned' || nextStatus === 'completed') {
      const existingAssign = db
        .prepare('SELECT department_id, status FROM assignments WHERE application_id = ?')
        .get(app.id) as { department_id: string; status: string } | undefined;
      const targetDeptId = existingAssign?.department_id || app.first_choice_dept_id;
      const currentQuotas = syncAndGetDepartmentsWithQuotas(app.round_id);
      const targetDept = currentQuotas.find((d) => d.id === targetDeptId);
      if (!targetDept) {
        return res.status(400).json({ error: 'Chưa xác định được ban phân công hợp lệ.' });
      }
      if (existingAssign?.status !== 'confirmed' && targetDept.remainingQuota <= 0) {
        return res.status(400).json({
          error: `${targetDept.name} đã hết chỉ tiêu nhận CTV (0/${targetDept.quota}).`,
        });
      }
    }

    const updatedApp = db.transaction(() => {
      if (nextStatus === 'decided_pass' || nextStatus === 'decided_fail') {
        const decisionVal = nextStatus === 'decided_pass' ? 'pass' : 'fail';
        db.prepare(`
          INSERT INTO selection_decisions (id, application_id, total_score, decision, decided_by, note, notified_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
          ON CONFLICT(application_id) DO UPDATE SET
            total_score = excluded.total_score,
            decision = excluded.decision,
            decided_by = excluded.decided_by,
            note = excluded.note,
            updated_at = excluded.updated_at
        `).run(crypto.randomUUID(), app.id, computedScore, decisionVal, req.user!.id, note, nowIso, nowIso);
      } else if (nextStatus === 'scored') {
        db.prepare('DELETE FROM selection_decisions WHERE application_id = ?').run(app.id);
      }

      const transitioned = transition({
        applicationId: app.id,
        nextStatus,
        actor: `user:${req.user!.id}`,
        action: 'UPDATE_APPLICATION_STATUS',
        ruleApplied: 'Validated State Machine Transition',
        inputSnapshot: { previousStatus: app.status, nextStatus, note },
        resultText: `${req.user!.full_name} đã chuyển trạng thái hồ sơ sang "${nextStatus}" (${note}).`,
        timestampIso: nowIso,
      });

      if (nextStatus === 'assigned' || nextStatus === 'completed') {
        syncAndGetDepartmentsWithQuotas(app.round_id);
      }

      return transitioned;
    })();

    return res.json({ application: enrichApplication(updatedApp) });
  }
);

// Step 11: BCN clicks "Chốt và gửi" after previewing recipients
const handleFinalizeAndNotify = (req: AuthenticatedRequest, res: Response) => {
  const targetIds: string[] | undefined = Array.isArray(req.body?.applicationIds)
    ? req.body.applicationIds
    : undefined;

  let pendingApps = db
    .prepare("SELECT * FROM applications WHERE status IN ('decided_pass', 'decided_fail')")
    .all() as Application[];

  if (targetIds && targetIds.length > 0) {
    const idSet = new Set(targetIds);
    pendingApps = pendingApps.filter((a) => idSet.has(a.id));
  }

  if (pendingApps.length === 0) {
    return res.status(400).json({
      error: 'Không có ứng viên nào ở trạng thái Chờ chốt và gửi thông báo Đậu/Rớt.',
    });
  }

  const nowIso = getSystemNowIso();
  let passedCount = 0;
  let failedCount = 0;

  for (const app of pendingApps) {
    if (app.status === 'decided_pass') {
      transition({
        applicationId: app.id,
        nextStatus: 'offer_sent',
        actor: `user:${req.user!.id}`,
        action: 'FINALIZE_AND_SEND_PASS',
        ruleApplied: 'Gate Kết quả tuyển chọn? = Đậu (Confirmed by BCN) -> Send Offer Notification',
        inputSnapshot: { finalizedBy: req.user!.full_name },
        resultText: `BCN (${req.user!.full_name}) đã chốt và gửi thông báo TRÚNG TUYỂN cho ứng viên.`,
        timestampIso: nowIso,
      });

      db.prepare('UPDATE selection_decisions SET notified_at = ?, updated_at = ? WHERE application_id = ?').run(
        nowIso,
        nowIso,
        app.id
      );

      NotificationService.send({
        applicationId: app.id,
        toEmail: app.email,
        templateKey: 'result_pass',
        variables: {
          full_name: app.full_name,
          link: '/my-application',
        },
        createdAt: nowIso,
      });
      passedCount += 1;
    } else if (app.status === 'decided_fail') {
      transition({
        applicationId: app.id,
        nextStatus: 'failed_interview',
        actor: `user:${req.user!.id}`,
        action: 'FINALIZE_AND_SEND_FAIL',
        ruleApplied: 'Gate Kết quả tuyển chọn? = Rớt (Confirmed by BCN) -> Send Fail Notification & End Case',
        inputSnapshot: { finalizedBy: req.user!.full_name },
        resultText: `BCN (${req.user!.full_name}) đã chốt và gửi thông báo RỚT phỏng vấn. Kết thúc "Ứng viên không đạt".`,
        endReason: 'failed_interview',
        timestampIso: nowIso,
      });

      db.prepare('UPDATE selection_decisions SET notified_at = ?, updated_at = ? WHERE application_id = ?').run(
        nowIso,
        nowIso,
        app.id
      );

      NotificationService.send({
        applicationId: app.id,
        toEmail: app.email,
        templateKey: 'result_fail',
        variables: {
          full_name: app.full_name,
          link: '/my-application',
        },
        createdAt: nowIso,
      });
      failedCount += 1;
    }
  }

  return res.json({
    finalizedTotal: passedCount + failedCount,
    sentCount: passedCount + failedCount,
    passedCount,
    failedCount,
  });
};

apiRouter.post('/selection/finalize-and-notify', requireAuth, requireRole('board', 'admin'), handleFinalizeAndNotify);
apiRouter.post('/selection/finalize', requireAuth, requireRole('board', 'admin'), handleFinalizeAndNotify);

// ============================================================================
// 7. STEP 12: CANDIDATE 1-CLICK CONFIRM & JOIN GROUP
// ============================================================================

const handleConfirmJoin = (req: AuthenticatedRequest, res: Response) => {
  const applicationId = req.params.id || req.body?.applicationId;
  const app = applicationId
    ? (db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Application | undefined)
    : (db
        .prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(req.user!.id) as Application | undefined);

  if (!app) {
    return res.status(404).json({ error: 'Không tìm thấy hồ sơ ứng tuyển.' });
  }
  if (req.user!.role === 'candidate' && app.user_id !== req.user!.id) {
    return res.status(403).json({ error: 'Bạn chỉ có thể xác nhận cho hồ sơ của chính mình.' });
  }
  if (app.status !== 'offer_sent') {
    return res.status(400).json({ error: 'Hồ sơ hiện không ở bước chờ xác nhận trúng tuyển.' });
  }

  const round = db
    .prepare('SELECT * FROM recruitment_rounds WHERE id = ?')
    .get(app.round_id) as RecruitmentRound;

  const nowIso = getSystemNowIso();
  const updated = transition({
    applicationId: app.id,
    nextStatus: 'confirmed_joined',
    actor: `user:${req.user!.id}`,
    action: 'CONFIRM_AND_JOIN_GROUP',
    ruleApplied: 'Merged Step 12: Candidate Confirms Offer & Receives Group Link Immediately',
    inputSnapshot: { groupLink: round.group_link },
    resultText: `Ứng viên đã bấm xác nhận tham gia và nhận link nhóm sinh hoạt CLB (${round.group_link}).`,
    timestampIso: nowIso,
  });

  return res.json({
    application: enrichApplication(updated),
    groupLink: round.group_link,
  });
};

apiRouter.post('/confirm-join', requireAuth, handleConfirmJoin);
apiRouter.post('/applications/:id/confirm-join', requireAuth, handleConfirmJoin);

// ============================================================================
// 8. STEP 13-14: AI-ASSISTED DEPARTMENT ASSIGNMENT & HR FINALIZATION
// ============================================================================

apiRouter.get(
  '/assignments/suggest',
  requireAuth,
  requireRole('hr', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const round = db
      .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
      .get() as RecruitmentRound;

    const initialDeptQuotaInfo = syncAndGetDepartmentsWithQuotas(round.id);
    const deptMap = new Map(initialDeptQuotaInfo.map((d) => [d.id, d.name]));

    const pendingApps = db
      .prepare(`
        SELECT * FROM applications
        WHERE round_id = ? AND status = 'confirmed_joined'
        ORDER BY updated_at ASC
      `)
      .all(round.id) as Application[];

    const criteria = db
      .prepare('SELECT id, weight, max_score FROM scoring_criteria WHERE round_id = ?')
      .all(round.id) as Array<{ id: string; weight: number; max_score: number }>;

    const candidatesForAi = pendingApps.map((a) => {
      const enriched = enrichApplication(a);
      const computedInterviewScore =
        enriched.scorecards && enriched.scorecards.length > 0
          ? computeTotalScore(enriched.scorecards, criteria)
          : null;
      const totalScore =
        enriched.selection_decision?.total_score ??
        computedInterviewScore ??
        enriched.screening_score ??
        0;
      return {
        applicationId: a.id,
        fullName: a.full_name,
        totalScore,
        firstChoiceDeptId: a.first_choice_dept_id,
        firstChoiceName: deptMap.get(a.first_choice_dept_id) || '',
        secondChoiceDeptId: a.second_choice_dept_id,
        secondChoiceName: a.second_choice_dept_id ? deptMap.get(a.second_choice_dept_id) || '' : '',
        experience: a.experience,
      };
    });

    const runFreshAi = req.query.refresh === 'true';
    let usedAi = false;
    let aiMessage = 'Hiển thị gợi ý phân ban hiện tại.';

    // Check if any candidate lacks a suggestion or if HR requested fresh AI run
    const needsGeneration =
      runFreshAi ||
      pendingApps.some((a) => {
        const existing = db
          .prepare('SELECT id FROM assignments WHERE application_id = ?')
          .get(a.id);
        return !existing;
      });

    if (needsGeneration && candidatesForAi.length > 0) {
      const aiResult = await generateDepartmentAssignments(candidatesForAi, initialDeptQuotaInfo);
      usedAi = aiResult.usedAi;
      aiMessage = aiResult.aiMessage;
      const nowIso = getSystemNowIso();

      for (const item of aiResult.suggestions) {
        // Re-check application status after async AI call so we never overwrite an already-confirmed candidate
        const currentApp = db
          .prepare('SELECT status FROM applications WHERE id = ?')
          .get(item.applicationId) as { status: string } | undefined;
        if (!currentApp || currentApp.status !== 'confirmed_joined') {
          continue;
        }

        if (!item.departmentId || !deptMap.has(item.departmentId)) {
          // If no department has remaining quota, remove any stale unconfirmed suggestion
          db.prepare("DELETE FROM assignments WHERE application_id = ? AND status = 'suggested'").run(
            item.applicationId
          );
          continue;
        }
        db.prepare(`
          INSERT INTO assignments (id, application_id, department_id, ai_suggested_dept_id, ai_reason, status, confirmed_by, notified_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'suggested', NULL, NULL, ?, ?)
          ON CONFLICT(application_id) DO UPDATE SET
            department_id = excluded.department_id,
            ai_suggested_dept_id = excluded.ai_suggested_dept_id,
            ai_reason = excluded.ai_reason,
            status = 'suggested',
            updated_at = excluded.updated_at
          WHERE assignments.status != 'confirmed'
        `).run(
          crypto.randomUUID(),
          item.applicationId,
          item.departmentId,
          item.departmentId,
          item.reason,
          nowIso,
          nowIso
        );
      }

      writeAuditLog({
        applicationId: null,
        actor: `user:${req.user!.id}`,
        action: 'AI_SUGGEST_ASSIGNMENTS',
        ruleApplied: usedAi
          ? 'Gemini AI Department Suggestion + Backend Quota Validation'
          : 'Deterministic Fallback Quota & Preference Optimizer',
        inputSnapshot: { candidateCount: candidatesForAi.length, usedAi },
        result: aiMessage,
        createdAt: nowIso,
      });
    }

    // Re-query current pending, completed, and department quotas AFTER async AI generation
    const latestPendingApps = db
      .prepare(`
        SELECT * FROM applications
        WHERE round_id = ? AND status = 'confirmed_joined'
        ORDER BY updated_at ASC
      `)
      .all(round.id) as Application[];

    const completedAssigned = db
      .prepare(`
        SELECT * FROM applications
        WHERE round_id = ? AND status IN ('assigned', 'completed')
        ORDER BY COALESCE(finished_at, updated_at) DESC
      `)
      .all(round.id) as Application[];

    const latestDeptQuotaInfo = syncAndGetDepartmentsWithQuotas(round.id);

    return res.json({
      candidates: latestPendingApps.map(enrichApplication),
      completedCandidates: completedAssigned.map(enrichApplication),
      departments: latestDeptQuotaInfo,
      usedAi,
      aiMessage,
    });
  }
);

// HR manually adjusts department before confirming
apiRouter.put(
  '/assignments/:applicationId',
  requireAuth,
  requireRole('hr', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const { departmentId } = req.body || {};
    if (!departmentId) {
      return res.status(400).json({ error: 'Vui lòng chọn ban phân công.' });
    }

    const app = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.applicationId) as Application | undefined;

    if (!app) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
    }

    const dept = db
      .prepare('SELECT * FROM departments WHERE id = ? AND round_id = ?')
      .get(departmentId, app.round_id) as Department | undefined;
    if (!dept) {
      return res.status(400).json({ error: `Ban không hợp lệ: ${departmentId}` });
    }

    const nowIso = getSystemNowIso();
    const existing = db
      .prepare('SELECT * FROM assignments WHERE application_id = ?')
      .get(app.id) as { id: string } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE assignments
        SET department_id = ?, updated_at = ?
        WHERE application_id = ?
      `).run(departmentId, nowIso, app.id);
    } else {
      db.prepare(`
        INSERT INTO assignments (id, application_id, department_id, ai_suggested_dept_id, ai_reason, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'HR chọn trực tiếp', 'suggested', ?, ?)
      `).run(crypto.randomUUID(), app.id, departmentId, departmentId, nowIso, nowIso);
    }

    return res.json({ application: enrichApplication(app) });
  }
);

// Step 13-14: HR clicks "Chốt phân công và gửi"
apiRouter.post(
  '/assignments/confirm',
  requireAuth,
  requireRole('hr', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const items: Array<{ applicationId: string; departmentId: string }> = Array.isArray(req.body?.assignments)
      ? req.body.assignments
      : [];

    const round = db
      .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
      .get() as RecruitmentRound;

    // If items not explicitly passed, confirm all currently in 'confirmed_joined' with a 'suggested' assignment
    let targetAssignments = items;
    if (targetAssignments.length === 0) {
      const pendingRows = db
        .prepare(`
          SELECT a.application_id as applicationId, a.department_id as departmentId
          FROM assignments a
          JOIN applications app ON app.id = a.application_id
          WHERE app.round_id = ? AND app.status IN ('confirmed_joined', 'assigned') AND a.status = 'suggested' AND a.department_id != ''
        `)
        .all(round.id) as Array<{ applicationId: string; departmentId: string }>;
      targetAssignments = pendingRows;
    }

    if (targetAssignments.length === 0) {
      return res.status(400).json({ error: 'Không có ứng viên nào đang chờ chốt phân công.' });
    }

    // Deduplicate by applicationId (keep last) and validate each application & department strictly before committing
    const dedupedMap = new Map<string, string>();
    for (const item of targetAssignments) {
      if (!item?.applicationId || !item?.departmentId) {
        return res.status(400).json({ error: 'Thiếu applicationId hoặc departmentId trong danh sách phân công.' });
      }
      dedupedMap.set(item.applicationId, item.departmentId);
    }

    const departments = db
      .prepare('SELECT * FROM departments WHERE round_id = ?')
      .all(round.id) as Department[];

    const deptMap = new Map(departments.map((d) => [d.id, d]));
    const batchCountByDept = new Map<string, number>();
    const targetAppsMap = new Map<string, Application>();

    for (const [applicationId, departmentId] of dedupedMap.entries()) {
      if (!deptMap.has(departmentId)) {
        return res.status(400).json({ error: `Ban không hợp lệ: ${departmentId}` });
      }
      const app = db
        .prepare('SELECT * FROM applications WHERE id = ?')
        .get(applicationId) as Application | undefined;
      if (!app) {
        return res.status(404).json({ error: `Không tìm thấy hồ sơ ứng viên: ${applicationId}` });
      }
      if (!['confirmed_joined', 'assigned'].includes(app.status)) {
        return res.status(400).json({
          error: `Ứng viên "${app.full_name}" đang ở trạng thái "${app.status}", chưa xác nhận tham gia nhóm (confirmed_joined) nên chưa thể chốt phân ban.`,
        });
      }
      targetAppsMap.set(applicationId, app);
      batchCountByDept.set(departmentId, (batchCountByDept.get(departmentId) || 0) + 1);
    }

    const targetAppIds = Array.from(dedupedMap.keys());
    const placeholders = targetAppIds.map(() => '?').join(',');

    for (const [deptId, addCount] of batchCountByDept.entries()) {
      const dept = deptMap.get(deptId)!;
      const alreadyConfirmed = db
        .prepare(`
          SELECT COUNT(*) as cnt
          FROM assignments a
          JOIN applications app ON app.id = a.application_id
          WHERE a.department_id = ?
            AND a.status = 'confirmed'
            AND app.status != 'withdrawn'
            AND a.application_id NOT IN (${placeholders})
        `)
        .get(deptId, ...targetAppIds) as { cnt: number };

      const remaining = Math.max(0, dept.quota - alreadyConfirmed.cnt);
      if (addCount > remaining) {
        return res.status(400).json({
          error: `Vượt quá chỉ tiêu của ${dept.name}: chỉ còn ${remaining} chỉ tiêu nhưng bạn đang chọn phân công ${addCount} ứng viên.`,
        });
      }
    }

    const nowIso = getSystemNowIso();
    const completedIds: string[] = [];

    const tx = db.transaction(() => {
      for (const [applicationId, departmentId] of dedupedMap.entries()) {
        const app = targetAppsMap.get(applicationId)!;
        const dept = deptMap.get(departmentId)!;

        // Upsert assignment record so `assignments` table ALWAYS has a confirmed row before completing
        db.prepare(`
          INSERT INTO assignments (
            id, application_id, department_id, ai_suggested_dept_id, ai_reason, status, confirmed_by, notified_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, 'HR duyệt và chốt phân công', 'confirmed', ?, ?, ?, ?)
          ON CONFLICT(application_id) DO UPDATE SET
            department_id = excluded.department_id,
            status = 'confirmed',
            confirmed_by = excluded.confirmed_by,
            notified_at = excluded.notified_at,
            updated_at = excluded.updated_at
        `).run(
          crypto.randomUUID(),
          app.id,
          departmentId,
          departmentId,
          req.user!.id,
          nowIso,
          nowIso,
          nowIso
        );

        const verifiedAssignment = db
          .prepare("SELECT id, department_id, status FROM assignments WHERE application_id = ? AND status = 'confirmed'")
          .get(app.id) as { id: string; department_id: string; status: string } | undefined;

        if (!verifiedAssignment || verifiedAssignment.department_id !== departmentId) {
          throw new Error(`Không thể tạo bản ghi phân công hợp lệ cho hồ sơ ${app.id}.`);
        }

        if (app.status === 'confirmed_joined') {
          transition({
            applicationId: app.id,
            nextStatus: 'assigned',
            actor: `user:${req.user!.id}`,
            action: 'HR_CONFIRM_ASSIGNMENT',
            ruleApplied: 'HR Confirmed Department Assignment (Within Quota)',
            inputSnapshot: { departmentId: dept.id, departmentName: dept.name, assignmentId: verifiedAssignment.id },
            resultText: `HR (${req.user!.full_name}) đã duyệt và chốt phân công vào ${dept.name}.`,
            timestampIso: nowIso,
          });
        }

        transition({
          applicationId: app.id,
          nextStatus: 'completed',
          actor: 'system',
          action: 'SEND_ASSIGNMENT_AND_COMPLETE',
          ruleApplied: 'Step 14: Send Department Assignment Info -> End Case "Hoàn tất quy trình tuyển CTV"',
          inputSnapshot: { departmentId: dept.id, departmentName: dept.name, assignmentId: verifiedAssignment.id },
          resultText: `Đã gửi thông báo phân công ${dept.name} và kết thúc "Hoàn tất quy trình tuyển CTV".`,
          endReason: 'completed',
          timestampIso: nowIso,
        });

        NotificationService.send({
          applicationId: app.id,
          toEmail: app.email,
          templateKey: 'assignment_info',
          variables: {
            full_name: app.full_name,
            department: dept.name,
            link: round.group_link,
          },
          createdAt: nowIso,
        });

        completedIds.push(app.id);
      }
    });

    try {
      tx();
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Không thể chốt phân công.',
      });
    }

    const updatedDeptQuotaInfo = syncAndGetDepartmentsWithQuotas(round.id);
    const remainingPendingApps = db
      .prepare(`
        SELECT * FROM applications
        WHERE round_id = ? AND status = 'confirmed_joined'
        ORDER BY updated_at ASC
      `)
      .all(round.id) as Application[];
    const completedAssigned = db
      .prepare(`
        SELECT * FROM applications
        WHERE round_id = ? AND status IN ('assigned', 'completed')
        ORDER BY COALESCE(finished_at, updated_at) DESC
      `)
      .all(round.id) as Application[];

    return res.json({
      confirmedCount: completedIds.length,
      completedIds,
      departments: updatedDeptQuotaInfo,
      candidates: remainingPendingApps.map(enrichApplication),
      completedCandidates: completedAssigned.map(enrichApplication),
    });
  }
);

// ============================================================================
// 9. NOTIFICATIONS (OUTBOX) & AUDIT LOGS
// ============================================================================

apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'candidate') {
    const rows = db
      .prepare(`
        SELECT n.*, a.full_name as candidate_name
        FROM notifications n
        JOIN applications a ON a.id = n.application_id
        WHERE a.user_id = ?
        ORDER BY n.created_at DESC
      `)
      .all(req.user!.id);
    return res.json({ notifications: rows });
  }

  const rows = db
    .prepare(`
      SELECT n.*, a.full_name as candidate_name
      FROM notifications n
      LEFT JOIN applications a ON a.id = n.application_id
      ORDER BY n.created_at DESC
      LIMIT 200
    `)
    .all();

  return res.json({
    notifications: rows,
    templates: NotificationService.getTemplates(),
  });
});

apiRouter.get(
  '/audit-logs',
  requireAuth,
  requireRole('hr', 'board', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const { applicationId } = req.query;
    if (applicationId) {
      const rows = db
        .prepare(`
          SELECT l.*, a.full_name as candidate_name
          FROM audit_logs l
          LEFT JOIN applications a ON a.id = l.application_id
          WHERE l.application_id = ?
          ORDER BY l.created_at DESC
        `)
        .all(String(applicationId));
      return res.json({ auditLogs: rows });
    }

    const rows = db
      .prepare(`
        SELECT l.*, a.full_name as candidate_name
        FROM audit_logs l
        LEFT JOIN applications a ON a.id = l.application_id
        ORDER BY l.created_at DESC
        LIMIT 250
      `)
      .all();

    return res.json({ auditLogs: rows });
  }
);

// ============================================================================
// 10. DASHBOARD ANALYTICS (FUNNEL, 6 ENDPOINTS, CYCLE TIME, AS-IS VS TO-BE)
// ============================================================================

apiRouter.get(
  '/dashboard/stats',
  requireAuth,
  requireRole('hr', 'board', 'admin'),
  (_req: AuthenticatedRequest, res: Response) => {
    const apps = db.prepare('SELECT * FROM applications').all() as Application[];
    const totalApps = apps.length;

    // 1. Conversion Funnel by Stages
    const passedCheckCount = apps.filter(
      (a) => !['submitted', 'checking', 'needs_supplement', 'supplement_submitted', 'expired_supplement'].includes(a.status)
    ).length;

    const passedScreeningCount = apps.filter((a) =>
      [
        'clear_pass',
        'review_pass',
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
      ].includes(a.status)
    ).length;

    const bookedInterviewCount = apps.filter((a) =>
      [
        'booked',
        'interviewing',
        'scored',
        'decided_pass',
        'decided_fail',
        'failed_interview',
        'offer_sent',
        'confirmed_joined',
        'assigned',
        'completed',
      ].includes(a.status)
    ).length;

    const interviewedAndScoredCount = apps.filter((a) =>
      ['scored', 'decided_pass', 'decided_fail', 'failed_interview', 'offer_sent', 'confirmed_joined', 'assigned', 'completed'].includes(
        a.status
      )
    ).length;

    const passedInterviewCount = apps.filter((a) =>
      ['decided_pass', 'offer_sent', 'confirmed_joined', 'assigned', 'completed'].includes(a.status)
    ).length;

    const confirmedJoinedCount = apps.filter((a) =>
      ['confirmed_joined', 'assigned', 'completed'].includes(a.status)
    ).length;

    const completedCount = apps.filter((a) => a.status === 'completed').length;

    const funnel = [
      { stage: '1. Nộp hồ sơ', count: totalApps },
      { stage: '2. Đủ thông tin', count: passedCheckCount },
      { stage: '3. Đạt vòng Hồ sơ', count: passedScreeningCount },
      { stage: '4. Đã đặt lịch PV', count: bookedInterviewCount },
      { stage: '5. Đã PV & Chấm điểm', count: interviewedAndScoredCount },
      { stage: '6. Đậu Phỏng vấn', count: passedInterviewCount },
      { stage: '7. Xác nhận vào nhóm', count: confirmedJoinedCount },
      { stage: '8. Hoàn tất phân ban', count: completedCount },
    ];

    // 2. The 6 Required End States
    const endBreakdown = [
      {
        key: 'completed',
        label: 'Hoàn tất quy trình tuyển CTV',
        count: apps.filter((a) => a.end_reason === 'completed' || a.status === 'completed').length,
        color: '#16A34A',
      },
      {
        key: 'rejected_docs',
        label: 'Hồ sơ không đạt',
        count: apps.filter((a) => a.end_reason === 'rejected_docs' || a.status === 'rejected_docs').length,
        color: '#DC2626',
      },
      {
        key: 'failed_interview',
        label: 'Ứng viên không đạt (PV)',
        count: apps.filter((a) => a.end_reason === 'failed_interview' || a.status === 'failed_interview').length,
        color: '#EA580C',
      },
      {
        key: 'no_booking',
        label: 'Ứng viên không tham gia',
        count: apps.filter((a) => a.end_reason === 'no_booking' || a.status === 'no_booking').length,
        color: '#D97706',
      },
      {
        key: 'expired_supplement',
        label: 'Bị loại vì quá hạn',
        count: apps.filter((a) => a.end_reason === 'expired_supplement' || a.status === 'expired_supplement').length,
        color: '#9333EA',
      },
      {
        key: 'withdrawn',
        label: 'Đã rút đơn',
        count: apps.filter((a) => a.end_reason === 'withdrawn' || a.status === 'withdrawn').length,
        color: '#64748B',
      },
    ];

    // 3. Cycle Time Calculation (from submitted_at to finished_at)
    const finishedApps = apps.filter((a) => a.submitted_at && a.finished_at);
    let avgCycleTimeHours: number | null = null;
    let avgCycleTimeDays: number | null = null;
    if (finishedApps.length > 0) {
      const sumHours = finishedApps.reduce((acc, a) => {
        const diffMs = Math.max(0, new Date(a.finished_at!).getTime() - new Date(a.submitted_at).getTime());
        return acc + diffMs / (1000 * 3600);
      }, 0);
      avgCycleTimeHours = Math.round((sumHours / finishedApps.length) * 100) / 100;
      avgCycleTimeDays = Math.round((avgCycleTimeHours / 24) * 100) / 100;
    }

    // 4. Missing fields rate, auto-reject rate, reminders count
    const everSupplementedCount = apps.filter(
      (a) => a.supplement_count > 0 || a.status === 'needs_supplement' || a.status === 'expired_supplement'
    ).length;
    const missingInfoRate = totalApps > 0 ? Math.round((everSupplementedCount / totalApps) * 1000) / 10 : 0;

    const autoRejectedCount = apps.filter(
      (a) =>
        a.status === 'expired_supplement' ||
        a.status === 'no_booking' ||
        (a.status === 'rejected_docs' && a.screening_result === 'clear_fail')
    ).length;
    const autoRejectRate = totalApps > 0 ? Math.round((autoRejectedCount / totalApps) * 1000) / 10 : 0;

    const reminderNotifs = db
      .prepare("SELECT COUNT(*) as cnt FROM notifications WHERE template_key = 'schedule_reminder'")
      .get() as { cnt: number };

    // 5. Pending Backlogs for HR & BCN
    const hrNeedsReviewCount = apps.filter((a) => a.status === 'needs_review').length;
    const hrNearThresholdCount = apps.filter((a) => a.status === 'clear_fail').length;
    const hrPendingAssignmentCount = apps.filter((a) => a.status === 'confirmed_joined').length;
    const bcnPendingScoreOrDecideCount = apps.filter((a) =>
      ['interviewing', 'scored', 'decided_pass', 'decided_fail'].includes(a.status)
    ).length;

    // Stage average wait times (hours)
    const stageWaitTimes = [
      { stage: 'Kiểm tra & Sơ loại (Tự động)', asIsHours: 48, toBeHours: 0.1 },
      { stage: 'Bổ sung hồ sơ (Timer 2 ngày)', asIsHours: 72, toBeHours: 18.5 },
      { stage: 'Đặt lịch phỏng vấn (Tự chọn)', asIsHours: 60, toBeHours: 11.2 },
      { stage: 'Phỏng vấn & Hội tụ điểm (Song song)', asIsHours: 72, toBeHours: 14.0 },
      { stage: 'Xác nhận & Phân ban (AI gợi ý)', asIsHours: 36, toBeHours: 4.5 },
    ];

    return res.json({
      totalApplications: totalApps,
      funnel,
      endBreakdown,
      metrics: {
        avgCycleTimeHours,
        avgCycleTimeDays,
        finishedCount: finishedApps.length,
        missingInfoRate,
        autoRejectRate,
        remindersSentCount: reminderNotifs.cnt,
        hrBacklogTotal: hrNeedsReviewCount + hrNearThresholdCount + hrPendingAssignmentCount,
        hrNeedsReviewCount,
        hrNearThresholdCount,
        hrPendingAssignmentCount,
        bcnPendingCount: bcnPendingScoreOrDecideCount,
      },
      bth32Automation: {
        totalActivities: 26,
        manualCount: 10,
        manualPct: 38.5,
        ruleCount: 15,
        rulePct: 57.7,
        aiCount: 1,
        aiPct: 3.8,
        agentCount: 0,
      },
      stageWaitTimes,
      asIsComparison: {
        asIsCycleDays: 12,
        toBeCycleDays: avgCycleTimeDays,
        asIsHandoffs: 11,
        toBeHandoffs: 4,
        asIsManualScheduling: 'HR nhắn tin xếp lịch từng người (mất 2–3 ngày)',
        toBeSelfBooking: 'Ứng viên tự chọn khung giờ còn chỗ + Timer tự nhắc 1 ngày / gạch tên 2 ngày',
        asIsBatchWait: 'Chờ hết cả đợt phỏng vấn mới tổng hợp điểm',
        toBeParallelAndJoin: 'AND-join từng cá nhân ngay khi Check-in + đủ phiếu điểm',
      },
      systemNow: getSystemNowIso(),
      timeScale: Number(getSetting('TIME_SCALE', '1')) || 1,
    });
  }
);

// ============================================================================
// 11. ADMIN SETTINGS, TIME-TRAVEL (+1/+2 DAYS) & SEED
// ============================================================================

apiRouter.post(
  '/admin/seed',
  requireAuth,
  requireRole('admin', 'hr', 'board'),
  (req: AuthenticatedRequest, res: Response) => {
    const withSample = req.body?.mode === 'sample' || req.body?.withSample === true;
    const result = seedDatabase(true, withSample);
    const msg = withSample
      ? `Đã nạp lại dữ liệu mẫu thành công (${result.seededApplications} hồ sơ ứng viên).`
      : 'Đã đặt lại đợt tuyển trống thành công (0 hồ sơ ứng viên).';

    writeAuditLog({
      applicationId: null,
      actor: `user:${req.user!.id}`,
      action: 'ADMIN_RESEED_DATABASE',
      ruleApplied: withSample
        ? 'Reset & Seed Sample Dataset (6 Representative Cases)'
        : 'Reset Recruitment Round to Clean State (0 Applications)',
      inputSnapshot: result,
      result: msg,
      createdAt: getSystemNowIso(),
    });
    return res.json({
      message: msg,
      ...result,
      systemNow: getSystemNowIso(),
    });
  }
);

apiRouter.post(
  '/admin/time-travel',
  requireAuth,
  requireRole('admin', 'hr', 'board'),
  (req: AuthenticatedRequest, res: Response) => {
    const days = Number(req.body?.days) || 1;
    const currentOffset = Number(getSetting('virtual_offset_ms', '0')) || 0;
    const addedMs = days * 24 * 60 * 60 * 1000;
    setSetting('virtual_offset_ms', String(currentOffset + addedMs));

    const scanResult = runTimerTick(false);

    writeAuditLog({
      applicationId: null,
      actor: `user:${req.user!.id}`,
      action: 'TIME_TRAVEL_SIMULATION',
      ruleApplied: `Advance Virtual Clock +${days} day(s) & Trigger Background Timer Scan`,
      inputSnapshot: {
        daysAdded: days,
        newSystemNow: getSystemNowIso(),
        scanResult,
      },
      result: `Tua nhanh +${days} ngày: Quá hạn bổ sung (${scanResult.expiredSupplementsCount}), Nhắc đặt lịch (${scanResult.remindedBookingCount}), Gạch tên quá 2 ngày (${scanResult.droppedNoBookingCount}).`,
      createdAt: getSystemNowIso(),
    });

    return res.json({
      daysAdded: days,
      systemNow: getSystemNow().toISOString(),
      scanResult,
    });
  }
);

apiRouter.get(
  '/admin/settings',
  requireAuth,
  requireRole('admin', 'hr', 'board'),
  (_req: AuthenticatedRequest, res: Response) => {
    const round = db
      .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
      .get() as RecruitmentRound;
    const departments = db
      .prepare('SELECT * FROM departments WHERE round_id = ? ORDER BY name ASC')
      .all(round.id) as Department[];
    const criteria = db
      .prepare('SELECT * FROM scoring_criteria WHERE round_id = ? ORDER BY weight DESC')
      .all(round.id) as ScoringCriterion[];
    const users = db
      .prepare('SELECT id, email, full_name, role, created_at FROM users ORDER BY role ASC, created_at DESC')
      .all() as User[];

    let hardConditions = {
      requireValidEmail: true,
      requireActiveStudentId: true,
      requireValidPhone: true,
      requireTimeCommitment: true,
    };
    try {
      const raw = getSetting('hard_conditions', '');
      if (raw) hardConditions = { ...hardConditions, ...JSON.parse(raw) };
    } catch {
      // ignore
    }

    return res.json({
      round,
      departments,
      criteria,
      users,
      hardConditions,
      timeScale: Number(getSetting('TIME_SCALE', '1')) || 1,
      virtualOffsetMs: Number(getSetting('virtual_offset_ms', '0')) || 0,
      systemNow: getSystemNowIso(),
      templates: NotificationService.getTemplates(),
    });
  }
);

apiRouter.put(
  '/admin/settings',
  requireAuth,
  requireRole('admin', 'hr', 'board'),
  (req: AuthenticatedRequest, res: Response) => {
    const {
      round,
      departments,
      criteria,
      hardConditions,
      timeScale,
      templates,
    } = req.body || {};

    const nowIso = getSystemNowIso();
    const currentRound = db
      .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
      .get() as RecruitmentRound;

    // Validate all parameters before saving (F09)
    if (round && currentRound) {
      const nextStatus = round.status ?? currentRound.status;
      if (!['draft', 'open', 'closed'].includes(nextStatus)) {
        return res.status(400).json({ error: 'Trạng thái đợt tuyển không hợp lệ (chỉ nhận draft, open, closed).' });
      }

      const nextThresholdX = Number(round.threshold_x ?? currentRound.threshold_x);
      const nextThresholdY = Number(round.threshold_y ?? currentRound.threshold_y);
      const nextMargin = Number(round.near_threshold_margin ?? currentRound.near_threshold_margin);
      const nextSuppMaxRounds = Number(round.supplement_max_rounds ?? currentRound.supplement_max_rounds);
      const nextSuppDays = Number(round.supplement_deadline_days ?? currentRound.supplement_deadline_days);
      const nextRemindDays = Number(round.remind_after_days ?? currentRound.remind_after_days);
      const nextUnbookDays = Number(round.unbook_after_days ?? currentRound.unbook_after_days);
      const nextMinScorecards = Number(
        round.min_scorecards_per_interview ?? currentRound.min_scorecards_per_interview
      );

      if (
        !Number.isFinite(nextThresholdX) ||
        !Number.isFinite(nextThresholdY) ||
        nextThresholdY < 0 ||
        nextThresholdX > 100 ||
        nextThresholdY >= nextThresholdX
      ) {
        return res.status(400).json({
          error: 'Ngưỡng điểm sơ loại không hợp lệ: yêu cầu 0 <= Ngưỡng Y < Ngưỡng X <= 100.',
        });
      }

      if (!Number.isFinite(nextMargin) || nextMargin < 0 || nextMargin > nextThresholdY) {
        return res.status(400).json({
          error: 'Biên độ sát ngưỡng Y không hợp lệ: yêu cầu 0 <= Biên độ <= Ngưỡng Y.',
        });
      }

      if (!Number.isFinite(nextSuppDays) || nextSuppDays <= 0) {
        return res.status(400).json({
          error: 'Thời hạn bổ sung hồ sơ phải lớn hơn 0 ngày.',
        });
      }

      if (!Number.isFinite(nextSuppMaxRounds) || nextSuppMaxRounds < 1) {
        return res.status(400).json({
          error: 'Số lần bổ sung tối đa phải >= 1.',
        });
      }

      if (
        !Number.isFinite(nextRemindDays) ||
        !Number.isFinite(nextUnbookDays) ||
        nextRemindDays <= 0 ||
        nextUnbookDays <= nextRemindDays
      ) {
        return res.status(400).json({
          error: 'Thời gian nhắc lịch và gạch tên không hợp lệ: yêu cầu 0 < Nhắc sau (ngày) < Gạch tên sau (ngày).',
        });
      }

      if (!Number.isFinite(nextMinScorecards) || nextMinScorecards < 1) {
        return res.status(400).json({
          error: 'Số phiếu chấm tối thiểu mỗi ứng viên phải >= 1.',
        });
      }

      const nextOpenAt = round.open_at ? new Date(String(round.open_at)) : new Date(currentRound.open_at);
      const nextCloseAt = round.close_at ? new Date(String(round.close_at)) : new Date(currentRound.close_at);
      if (
        Number.isNaN(nextOpenAt.getTime()) ||
        Number.isNaN(nextCloseAt.getTime()) ||
        nextCloseAt.getTime() <= nextOpenAt.getTime()
      ) {
        return res.status(400).json({
          error: 'Thời gian đóng đơn (close_at) phải lớn hơn thời gian mở đơn (open_at).',
        });
      }
    }

    if (Array.isArray(departments)) {
      for (const d of departments) {
        const q = Number(d.quota);
        if (!Number.isFinite(q) || q < 0 || !Number.isInteger(q)) {
          return res.status(400).json({
            error: `Chỉ tiêu (quota) của ban "${d.name || d.id}" không hợp lệ: phải là số nguyên >= 0.`,
          });
        }
      }
    }

    if (Array.isArray(criteria)) {
      for (const c of criteria) {
        const w = Number(c.weight);
        const m = Number(c.max_score ?? 10);
        if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(m) || m <= 0) {
          return res.status(400).json({
            error: `Tiêu chí chấm điểm "${c.name || c.id}" không hợp lệ: trọng số (weight) và thang điểm tối đa (max_score) phải > 0.`,
          });
        }
      }
    }

    if (timeScale !== undefined) {
      const ts = Number(timeScale);
      if (!Number.isFinite(ts) || ts <= 0) {
        return res.status(400).json({ error: 'Hệ số thời gian (TIME_SCALE) phải > 0.' });
      }
    }

    const tx = db.transaction(() => {
      if (round && currentRound) {
        db.prepare(`
          UPDATE recruitment_rounds
          SET
            name = ?,
            event_name = ?,
            status = ?,
            open_at = ?,
            close_at = ?,
            supplement_max_rounds = ?,
            supplement_deadline_days = ?,
            remind_after_days = ?,
            unbook_after_days = ?,
            threshold_x = ?,
            threshold_y = ?,
            near_threshold_margin = ?,
            min_scorecards_per_interview = ?,
            group_link = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          sanitizeText(round.name) || currentRound.name,
          sanitizeText(round.event_name) || currentRound.event_name,
          round.status || currentRound.status,
          round.open_at ? new Date(String(round.open_at)).toISOString() : currentRound.open_at,
          round.close_at ? new Date(String(round.close_at)).toISOString() : currentRound.close_at,
          Number(round.supplement_max_rounds ?? currentRound.supplement_max_rounds),
          Number(round.supplement_deadline_days ?? currentRound.supplement_deadline_days),
          Number(round.remind_after_days ?? currentRound.remind_after_days),
          Number(round.unbook_after_days ?? currentRound.unbook_after_days),
          Number(round.threshold_x ?? currentRound.threshold_x),
          Number(round.threshold_y ?? currentRound.threshold_y),
          Number(round.near_threshold_margin ?? currentRound.near_threshold_margin),
          Number(round.min_scorecards_per_interview ?? currentRound.min_scorecards_per_interview),
          sanitizeText(round.group_link) || currentRound.group_link,
          nowIso,
          currentRound.id
        );
      }

      if (Array.isArray(departments)) {
        const updateDept = db.prepare(`
          UPDATE departments SET name = ?, quota = ?, description = ?, updated_at = ? WHERE id = ?
        `);
        for (const d of departments) {
          if (d.id) {
            updateDept.run(sanitizeText(d.name), Number(d.quota), sanitizeText(d.description), nowIso, d.id);
          }
        }
      }

      if (Array.isArray(criteria)) {
        const updateCrit = db.prepare(`
          UPDATE scoring_criteria SET name = ?, weight = ?, max_score = ?, updated_at = ? WHERE id = ?
        `);
        for (const c of criteria) {
          if (c.id) {
            updateCrit.run(sanitizeText(c.name), Number(c.weight), Number(c.max_score || 10), nowIso, c.id);
          }
        }
      }

      if (hardConditions) {
        setSetting('hard_conditions', JSON.stringify(hardConditions));
      }

      if (timeScale !== undefined) {
        setSetting('TIME_SCALE', String(Number(timeScale)));
      }

      if (templates) {
        NotificationService.saveTemplates(templates);
      }

      writeAuditLog({
        applicationId: null,
        actor: `user:${req.user!.id}`,
        action: 'UPDATE_SYSTEM_SETTINGS',
        ruleApplied: 'Admin Configuration Updated',
        inputSnapshot: {
          thresholdX: round?.threshold_x,
          thresholdY: round?.threshold_y,
          nearThresholdMargin: round?.near_threshold_margin,
          timeScale,
        },
        result: `Đã cập nhật cấu hình hệ thống và ngưỡng quy tắc tự động.`,
        createdAt: nowIso,
      });
    });

    tx();

    return res.json({ message: 'Đã lưu cài đặt hệ thống thành công.', systemNow: getSystemNowIso() });
  }
);

// Deterministic rule testing endpoint before opening round ("Chính xác: cùng đầu vào cho cùng đầu ra, kiểm thử luật trước mỗi đợt tuyển")
apiRouter.post(
  '/admin/test-screening',
  requireAuth,
  requireRole('admin', 'hr', 'board'),
  (req: AuthenticatedRequest, res: Response) => {
    const round = db
      .prepare('SELECT * FROM recruitment_rounds ORDER BY created_at DESC LIMIT 1')
      .get() as RecruitmentRound;

    const thresholdX = Number(req.body?.threshold_x ?? req.body?.thresholdX ?? round.threshold_x);
    const thresholdY = Number(req.body?.threshold_y ?? req.body?.thresholdY ?? round.threshold_y);
    const margin = Number(
      req.body?.near_threshold_margin ?? req.body?.nearThresholdMargin ?? round.near_threshold_margin
    );

    let hardConfig = {
      requireValidEmail: true,
      requireActiveStudentId: true,
      requireValidPhone: true,
      requireTimeCommitment: true,
    };
    try {
      const raw = getSetting('hard_conditions', '');
      if (raw) hardConfig = { ...hardConditionsFromRaw(raw), ...hardConfig };
    } catch {
      // ignore
    }
    if (req.body?.hardConditions) {
      hardConfig = { ...hardConfig, ...req.body.hardConditions };
    }

    const body = req.body || {};
    const commitmentConfirmed =
      body.commitment_confirmed !== undefined
        ? Boolean(body.commitment_confirmed)
        : body.timeCommitmentConfirmed !== undefined
          ? Boolean(body.timeCommitmentConfirmed)
          : true;
    const isActiveStudent =
      body.is_active_student !== undefined
        ? Boolean(body.is_active_student)
        : body.hasActiveStudentId !== undefined
          ? Boolean(body.hasActiveStudentId)
          : true;
    const experienceText = String(
      body.experience ?? body.skillsText ?? body.motivationText ?? ''
    );
    const studentId = String(body.student_id ?? body.studentId ?? '231121521999');
    const className = String(body.class_name ?? body.className ?? '49K01.1');
    const cvUrl = String(body.cv_url ?? body.cvUrl ?? '');
    const secondChoiceDeptId = String(
      body.second_choice_dept_id ?? body.secondChoiceDeptId ?? 'dept-er'
    );

    const evalRes = evaluateScreeningProfile(
      {
        email: String(body.email ?? 'ungvien@due.udn.vn'),
        student_id: studentId,
        phone: String(body.phone ?? '0905888999'),
        class_name: className,
        experience: experienceText,
        cv_url: cvUrl,
        second_choice_dept_id: secondChoiceDeptId,
        commitment_confirmed: commitmentConfirmed,
        is_active_student: isActiveStudent,
      },
      hardConfig
    );

    const branch = screenByThreshold(evalRes.score, evalRes.hardConditionsPassed, thresholdX, thresholdY);
    const nearThreshold =
      branch === 'clear_fail' &&
      isNearThreshold(evalRes.score, evalRes.hardConditionsPassed, thresholdY, margin);

    const branchLabel =
      branch === 'clear_pass'
        ? `Đạt rõ (Điểm ${evalRes.score} >= X=${thresholdX} & đủ điều kiện cứng)`
        : branch === 'needs_review'
          ? `Cần xem xét (${thresholdY} <= Điểm ${evalRes.score} < ${thresholdX} & đủ điều kiện cứng)`
          : !evalRes.hardConditionsPassed
            ? `Loại rõ (Vi phạm điều kiện cứng: ${evalRes.violatedConditions.join('; ')})`
            : `Loại rõ (Điểm ${evalRes.score} < Y=${thresholdY}${nearThreshold ? ' — Hồ sơ sát ngưỡng Y' : ''})`;

    const bd = evalRes.scoreBreakdown;
    const breakdownSummary = `Học vụ: ${bd.academic}/25đ | Kinh nghiệm: ${bd.experience}/45đ | Nguyện vọng 2: ${bd.choiceFlexibility}/15đ | CV/Portfolio: ${bd.cvPortfolio}/15đ`;

    const evaluation = {
      totalScore: evalRes.score,
      score: evalRes.score,
      scoreBreakdown: evalRes.scoreBreakdown,
      hardConditionsPassed: evalRes.hardConditionsPassed,
      violatedConditions: evalRes.violatedConditions,
      branch,
      nearThreshold,
      explanation: `${branchLabel}. Chi tiết: ${breakdownSummary}`,
    };

    return res.json({
      score: evalRes.score,
      totalScore: evalRes.score,
      scoreBreakdown: evalRes.scoreBreakdown,
      hardConditionsPassed: evalRes.hardConditionsPassed,
      violatedConditions: evalRes.violatedConditions,
      branch,
      nearThreshold,
      explanation: evaluation.explanation,
      thresholdX,
      thresholdY,
      margin,
      evaluation,
    });
  }
);

function hardConditionsFromRaw(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

