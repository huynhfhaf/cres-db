import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import type { Server } from 'node:http';

const testDbPath = path.join(
  os.tmpdir(),
  `cres-recruit-integration-test-${ process.pid }-${ Date.now() }.db`
);
process.env.CRES_DB_PATH = testDbPath;

const { initDatabase, db } = await import('../db/database.ts');
const { seedDatabase } = await import('../db/seed.ts');
const { apiRouter } = await import('./api.ts');

let server: Server;
let baseUrl = '';

async function api(
  endpoint: string,
  options: { method?: string; token?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const res = await fetch(`${baseUrl}/api${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function loginAs(email: string, password = '123456'): Promise<string> {
  const res = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(res.status, 200, `Login failed for ${email}: ${JSON.stringify(res.data)}`);
  return res.data.token as string;
}

before(async () => {
  initDatabase();
  seedDatabase(true, false);
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  try {
    db.close();
  } catch {
    // ignore
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (fs.existsSync(testDbPath + suffix)) {
        fs.unlinkSync(testDbPath + suffix);
      }
    } catch {
      // ignore
    }
  }
});

test('F12 & F13: Seed empty vs sample modes and honest cycle time when 0 applications finished', async () => {
  const adminToken = await loginAs('admin@cres.due.udn.vn');

  // 1. Seed empty mode -> 0 applications
  const emptySeed = await api('/admin/seed', {
    method: 'POST',
    token: adminToken,
    body: { mode: 'empty' },
  });
  assert.equal(emptySeed.status, 200);
  assert.equal(emptySeed.data.seededApplications, 0);
  assert.match(emptySeed.data.message, /0 hồ sơ/);

  // 2. Dashboard stats with 0 applications -> avgCycleTimeHours is null (no hardcoded 1.6h or 0.5h floor)
  const statsEmpty = await api('/dashboard/stats', { token: adminToken });
  assert.equal(statsEmpty.status, 200);
  assert.equal(statsEmpty.data.totalApplications, 0);
  assert.equal(statsEmpty.data.metrics.avgCycleTimeHours, null);
  assert.equal(statsEmpty.data.metrics.finishedCount, 0);
  assert.equal(statsEmpty.data.metrics.bimpExpectedCycleHours, undefined);

  // 3. Seed sample mode -> 6 representative applications
  const sampleSeed = await api('/admin/seed', {
    method: 'POST',
    token: adminToken,
    body: { mode: 'sample' },
  });
  assert.equal(sampleSeed.status, 200);
  assert.equal(sampleSeed.data.seededApplications, 6);

  // Reset back to empty for subsequent deterministic tests
  await api('/admin/seed', {
    method: 'POST',
    token: adminToken,
    body: { mode: 'empty' },
  });
});

test('F01: /admin/test-screening returns nested evaluation object and maps both camelCase and snake_case inputs', async () => {
  const adminToken = await loginAs('admin@cres.due.udn.vn');

  // 1. High-scoring profile with commitmentConfirmed = true
  const passRes = await api('/admin/test-screening', {
    method: 'POST',
    token: adminToken,
    body: {
      student_id: '231121521101',
      class_name: '49K01.1',
      email: 'ungvien@due.udn.vn',
      phone: '0905123456',
      experience:
        'Từng tham gia tổ chức sự kiện tại trường, thiết kế Canva, viết bài truyền thông fanpage và điều phối hậu cần cho hội thảo sinh viên tại Đại học Kinh tế - ĐH Đà Nẵng. Em cam kết gắn bó lâu dài.',
      cv_url: 'https://drive.google.com/file/d/cv-1',
      second_choice_dept_id: 'dept-er',
      timeCommitmentConfirmed: true,
      hasActiveStudentId: true,
    },
  });
  assert.equal(passRes.status, 200);
  assert.ok(passRes.data.evaluation, 'Response must include evaluation object');
  assert.equal(passRes.data.evaluation.totalScore, passRes.data.score);
  assert.equal(passRes.data.evaluation.branch, 'clear_pass');
  assert.equal(passRes.data.evaluation.hardConditionsPassed, true);
  assert.ok(typeof passRes.data.evaluation.explanation === 'string' && passRes.data.evaluation.explanation.length > 0);

  // 2. Same profile with timeCommitmentConfirmed = false -> must fail hard condition and route to clear_fail
  const failHardRes = await api('/admin/test-screening', {
    method: 'POST',
    token: adminToken,
    body: {
      student_id: '231121521101',
      class_name: '49K01.1',
      email: 'ungvien@due.udn.vn',
      phone: '0905123456',
      experience: 'Kinh nghiệm đầy đủ',
      timeCommitmentConfirmed: false,
    },
  });
  assert.equal(failHardRes.status, 200);
  assert.equal(failHardRes.data.evaluation.hardConditionsPassed, false);
  assert.equal(failHardRes.data.evaluation.branch, 'clear_fail');
});

test('F08 & F09: /slots and /admin/settings validate dates, timezones, thresholds, and quotas strictly', async () => {
  const adminToken = await loginAs('admin@cres.due.udn.vn');
  const bcnToken = await loginAs('bcn@cres.due.udn.vn');

  // F08: Slot with end_at <= start_at must return 400
  const invalidSlot = await api('/slots', {
    method: 'POST',
    token: bcnToken,
    body: {
      start_at: '2026-12-10T10:00',
      end_at: '2026-12-10T09:00',
      location_or_link: 'Phòng B202',
      capacity: 5,
    },
  });
  assert.equal(invalidSlot.status, 400);

  // F08: Slot with datetime-local string (no offset) is interpreted as +07:00 (09:00+07:00 -> 02:00:00.000Z)
  const validSlot = await api('/slots', {
    method: 'POST',
    token: bcnToken,
    body: {
      start_at: '2026-12-10T09:00',
      end_at: '2026-12-10T11:00',
      location_or_link: 'Phòng B202',
      capacity: 5,
    },
  });
  assert.equal(validSlot.status, 201);
  assert.equal(validSlot.data.slot.start_at, '2026-12-10T02:00:00.000Z');
  assert.equal(validSlot.data.slot.end_at, '2026-12-10T04:00:00.000Z');

  // F09: Invalid threshold_y >= threshold_x -> 400
  const badThresholds = await api('/admin/settings', {
    method: 'PUT',
    token: adminToken,
    body: {
      round: { threshold_x: 50, threshold_y: 80 },
    },
  });
  assert.equal(badThresholds.status, 400);

  // F09: Invalid remind_after_days >= unbook_after_days -> 400
  const badTimers = await api('/admin/settings', {
    method: 'PUT',
    token: adminToken,
    body: {
      round: { remind_after_days: 3, unbook_after_days: 2 },
    },
  });
  assert.equal(badTimers.status, 400);

  // F09: Negative department quota -> 400
  const badQuota = await api('/admin/settings', {
    method: 'PUT',
    token: adminToken,
    body: {
      departments: [{ id: 'dept-media', name: 'Ban Truyền thông', quota: -2, description: '' }],
    },
  });
  assert.equal(badQuota.status, 400);
});

test('F11: POST /applications blocks submissions when round is closed or expired', async () => {
  const adminToken = await loginAs('admin@cres.due.udn.vn');
  const candToken = await loginAs('ungvien@due.udn.vn');

  // Close the round
  const closeRes = await api('/admin/settings', {
    method: 'PUT',
    token: adminToken,
    body: { round: { status: 'closed' } },
  });
  assert.equal(closeRes.status, 200);

  const blockedSubmit = await api('/applications', {
    method: 'POST',
    token: candToken,
    body: {
      full_name: 'Ứng viên Đóng Đơn',
      student_id: '231121521900',
      class_name: '49K01.1',
      email: 'ungvien@due.udn.vn',
      phone: '0905111222',
      first_choice_dept_id: 'dept-media',
      experience: 'Kinh nghiệm truyền thông',
      essay: 'Bài luận dài',
      commitment_confirmed: true,
    },
  });
  assert.equal(blockedSubmit.status, 400);

  // Re-open the round
  await api('/admin/settings', {
    method: 'PUT',
    token: adminToken,
    body: { round: { status: 'open' } },
  });
});

test('F02, F03, F04, F05, F06, F07, F10: Full workflow + RBAC, PII protection, 0-score preservation, parallel AND-join, and assignment integrity', async () => {
  const adminToken = await loginAs('admin@cres.due.udn.vn');
  const hrToken = await loginAs('hr@cres.due.udn.vn');
  const bcnToken = await loginAs('bcn@cres.due.udn.vn');

  // Reset to clean empty round
  await api('/admin/seed', {
    method: 'POST',
    token: adminToken,
    body: { mode: 'empty' },
  });

  // Register two fresh candidates
  const reg1 = await api('/auth/register', {
    method: 'POST',
    body: { full_name: 'Trần Minh Quân', email: 'quan.tm@due.udn.vn', password: 'password123' },
  });
  assert.equal(reg1.status, 200);
  const cand1Token = reg1.data.token as string;

  const reg2 = await api('/auth/register', {
    method: 'POST',
    body: { full_name: 'Lê Thảo Nguyên', email: 'nguyen.lt@due.udn.vn', password: 'password123' },
  });
  assert.equal(reg2.status, 200);
  const cand2Token = reg2.data.token as string;

  // Candidate 1 submits a clear_pass application (100 points screening)
  const app1Res = await api('/applications', {
    method: 'POST',
    token: cand1Token,
    body: {
      full_name: 'Trần Minh Quân',
      student_id: '231121521111',
      class_name: '49K01.1',
      email: 'quan.tm@due.udn.vn',
      phone: '0905111222',
      first_choice_dept_id: 'dept-media',
      second_choice_dept_id: 'dept-er',
      experience:
        'Đã từng làm Trưởng nhóm Truyền thông CLB cấp Khoa, thiết kế Canva, Photoshop, dựng video CapCut, tổ chức sự kiện chào tân sinh viên hơn 500 người tham dự tại DUE.',
      essay:
        'Em mong muốn gắn bó lâu dài với Câu lạc bộ Thương mại C-RES, đóng góp kỹ năng thiết kế và truyền thông cho các sự kiện học thuật và hội thảo.',
      cv_url: 'https://drive.google.com/file/d/cv-quan',
      commitment_confirmed: true,
      is_active_student: true,
    },
  });
  assert.equal(app1Res.status, 201);
  const app1Id = app1Res.data.application.id as string;
  assert.equal(app1Res.data.application.status, 'invited_to_book');
  assert.equal(app1Res.data.application.screening_score, 100);

  // Candidate 2 submits a clear_pass application
  const app2Res = await api('/applications', {
    method: 'POST',
    token: cand2Token,
    body: {
      full_name: 'Lê Thảo Nguyên',
      student_id: '231121521222',
      class_name: '49K02.1',
      email: 'nguyen.lt@due.udn.vn',
      phone: '0905333444',
      first_choice_dept_id: 'dept-media',
      second_choice_dept_id: 'dept-event',
      experience:
        'Đã từng tham gia Ban Tổ chức sự kiện hội thảo sinh viên, điều phối hậu cần, thiết kế ấn phẩm truyền thông và viết bài fanpage tại trường ĐH Kinh tế - ĐH Đà Nẵng.',
      essay:
        'Em yêu thích môi trường chuyên nghiệp của Câu lạc bộ Thương mại C-RES và cam kết tham gia đầy đủ mọi hoạt động của CLB.',
      cv_url: 'https://drive.google.com/file/d/cv-nguyen',
      commitment_confirmed: true,
      is_active_student: true,
    },
  });
  assert.equal(app2Res.status, 201);
  const app2Id = app2Res.data.application.id as string;
  assert.equal(app2Res.data.application.status, 'invited_to_book');

  // F03: Unknown status & stage skipping via PUT /applications/:id/status must be rejected (400 / 403)
  const unknownStatusRes = await api(`/applications/${app1Id}/status`, {
    method: 'PUT',
    token: bcnToken,
    body: { status: 'hacked_status' },
  });
  assert.equal(unknownStatusRes.status, 400);

  const skipStageRes = await api(`/applications/${app1Id}/status`, {
    method: 'PUT',
    token: bcnToken,
    body: { status: 'decided_pass' },
  });
  assert.equal(skipStageRes.status, 400);

  const hrSetInterviewDecisionRes = await api(`/applications/${app1Id}/status`, {
    method: 'PUT',
    token: hrToken,
    body: { status: 'decided_pass' },
  });
  assert.equal(hrSetInterviewDecisionRes.status, 403);

  // F07: Candidate 1 books a slot; Candidate 2 queries GET /slots -> must NOT see Candidate 1's PII
  const slotsRes = await api('/slots', { token: cand1Token });
  assert.equal(slotsRes.status, 200);
  const targetSlotId = slotsRes.data.slots[0].id as string;

  const book1Res = await api(`/applications/${app1Id}/book`, {
    method: 'POST',
    token: cand1Token,
    body: { slotId: targetSlotId },
  });
  assert.equal(book1Res.status, 200);
  assert.equal(book1Res.data.application.status, 'booked');

  const slotsForCand2 = await api('/slots', { token: cand2Token });
  assert.equal(slotsForCand2.status, 200);
  const slotViewForCand2 = slotsForCand2.data.slots.find((s: { id: string }) => s.id === targetSlotId);
  assert.equal(slotViewForCand2.booked_count, 1);
  assert.deepEqual(
    slotViewForCand2.bookings,
    [],
    'Candidate 2 must not see Candidate 1 personal booking details (F07)'
  );

  // F06: Expire Candidate 2's schedule_deadline_at in DB and attempt to book BEFORE background timer runs -> must fail with 400 and drop to no_booking
  db.prepare('UPDATE applications SET schedule_deadline_at = ? WHERE id = ?').run(
    '2020-01-01T00:00:00.000Z',
    app2Id
  );
  const expiredBookRes = await api(`/applications/${app2Id}/book`, {
    method: 'POST',
    token: cand2Token,
    body: { slotId: targetSlotId },
  });
  assert.equal(expiredBookRes.status, 400);
  const app2AfterExpiredBook = await api(`/applications/${app2Id}`, { token: hrToken });
  assert.equal(app2AfterExpiredBook.data.application.status, 'no_booking');

  // F02: HR attempts to call /selection/:id/decide -> must be blocked with 403
  const hrDecideAttempt = await api(`/selection/${app1Id}/decide`, {
    method: 'POST',
    token: hrToken,
    body: { decision: 'pass' },
  });
  assert.equal(hrDecideAttempt.status, 403);

  // F02 & F10: BCN attempts to decide pass for Candidate 1 BEFORE check-in and scorecard -> must be blocked with 400
  const bcnPrematureDecide = await api(`/selection/${app1Id}/decide`, {
    method: 'POST',
    token: bcnToken,
    body: { decision: 'pass' },
  });
  assert.equal(bcnPrematureDecide.status, 400);

  // F10 & F04: BCN submits a scorecard with all 0 points BEFORE check-in
  // -> must NOT auto-check-in, status becomes 'interviewing', and computed score is 0 (not 100!)
  const scorecardZeroRes = await api(`/applications/${app1Id}/scorecards`, {
    method: 'POST',
    token: bcnToken,
    body: {
      scores: {
        'crit-attitude': 0,
        'crit-skill': 0,
        'crit-problem': 0,
        'crit-teamwork': 0,
        'crit-culture': 0,
      },
      comment: 'Ứng viên trả lời lạc đề hoàn toàn (0 điểm).',
    },
  });
  assert.equal(scorecardZeroRes.status, 200);
  assert.equal(scorecardZeroRes.data.application.status, 'interviewing');
  assert.equal(
    scorecardZeroRes.data.application.booking.checked_in_at,
    null,
    'Submitting scorecard must NOT auto-check-in candidate (F10)'
  );
  assert.equal(scorecardZeroRes.data.computedTotalScore, 0);

  // Check selection summary for F04: computed_total_score must be 0, NOT 100
  const summaryAfterZero = await api('/selection/summary', { token: bcnToken });
  const cand1SummaryZero = summaryAfterZero.data.candidates.find((c: { id: string }) => c.id === app1Id);
  assert.equal(
    cand1SummaryZero.computed_total_score,
    0,
    'Zero interview score must not fall back to 100 screening score (F04)'
  );

  // Now BCN checks in Candidate 1 -> parallel AND-join converges to 'scored'!
  const checkInRes = await api(`/applications/${app1Id}/check-in`, {
    method: 'POST',
    token: bcnToken,
  });
  assert.equal(checkInRes.status, 200);
  assert.equal(checkInRes.data.application.status, 'scored');
  assert.ok(checkInRes.data.application.booking.checked_in_at);

  // BCN updates scorecard to high scores (9.0 across all criteria -> 90 points) and decides 'pass'
  const scorecardPassRes = await api(`/applications/${app1Id}/scorecards`, {
    method: 'POST',
    token: bcnToken,
    body: {
      scores: {
        'crit-attitude': 9,
        'crit-skill': 9,
        'crit-problem': 9,
        'crit-teamwork': 9,
        'crit-culture': 9,
      },
      comment: 'Ứng viên phỏng vấn xuất sắc.',
      decision: 'pass',
    },
  });
  assert.equal(scorecardPassRes.status, 200);
  assert.equal(scorecardPassRes.data.application.status, 'decided_pass');
  assert.equal(scorecardPassRes.data.application.selection_decision.total_score, 90);

  // BCN finalizes & sends offer notification -> status transitions to 'offer_sent'
  const finalizeRes = await api('/selection/finalize', {
    method: 'POST',
    token: bcnToken,
    body: { applicationIds: [app1Id] },
  });
  assert.equal(finalizeRes.status, 200);
  assert.equal(finalizeRes.data.sentCount, 1);

  // F05: HR tries to confirm assignment BEFORE candidate confirms joining -> must return 400
  const prematureAssignRes = await api('/assignments/confirm', {
    method: 'POST',
    token: hrToken,
    body: {
      assignments: [{ applicationId: app1Id, departmentId: 'dept-media' }],
    },
  });
  assert.equal(prematureAssignRes.status, 400);

  // Candidate 1 clicks 1-step confirm & join group -> status becomes 'confirmed_joined'
  const confirmJoinRes = await api(`/applications/${app1Id}/confirm-join`, {
    method: 'POST',
    token: cand1Token,
  });
  assert.equal(confirmJoinRes.status, 200);
  assert.equal(confirmJoinRes.data.application.status, 'confirmed_joined');
  assert.ok(confirmJoinRes.data.groupLink);

  // F05: HR confirms assignment directly WITHOUT calling /assignments/suggest first
  // -> must upsert confirmed assignment record in `assignments` table and transition to `completed`
  const confirmAssignRes = await api('/assignments/confirm', {
    method: 'POST',
    token: hrToken,
    body: {
      assignments: [{ applicationId: app1Id, departmentId: 'dept-media' }],
    },
  });
  assert.equal(confirmAssignRes.status, 200);
  assert.equal(confirmAssignRes.data.confirmedCount, 1);

  const mediaDeptInConfirm = confirmAssignRes.data.departments.find((d: { id: string }) => d.id === 'dept-media');
  assert.equal(mediaDeptInConfirm.assignedCount, 1);
  assert.equal(mediaDeptInConfirm.remainingQuota, 7);

  // Calling /assignments/suggest?refresh=true after confirmation must keep assignedCount = 1 and remainingQuota = 7
  const suggestAfterConfirm = await api('/assignments/suggest?refresh=true', { token: hrToken });
  assert.equal(suggestAfterConfirm.status, 200);
  const mediaDeptAfterSuggest = suggestAfterConfirm.data.departments.find((d: { id: string }) => d.id === 'dept-media');
  assert.equal(mediaDeptAfterSuggest.assignedCount, 1);
  assert.equal(mediaDeptAfterSuggest.remainingQuota, 7);
  assert.equal(suggestAfterConfirm.data.candidates.length, 0);
  assert.equal(suggestAfterConfirm.data.completedCandidates.length, 1);

  const app1Completed = await api(`/applications/${app1Id}`, { token: hrToken });
  assert.equal(app1Completed.data.application.status, 'completed');
  assert.ok(app1Completed.data.application.assignment, 'Completed application must have an assignment record (F05)');
  assert.equal(app1Completed.data.application.assignment.status, 'confirmed');
  assert.equal(app1Completed.data.application.assignment.department_id, 'dept-media');

  // Verify F13: Dashboard stats now shows real measured avgCycleTimeHours (>= 0, not null)
  const statsAfterComplete = await api('/dashboard/stats', { token: adminToken });
  assert.equal(statsAfterComplete.data.metrics.finishedCount, 2); // app1 (completed) + app2 (no_booking)
  assert.equal(typeof statsAfterComplete.data.metrics.avgCycleTimeHours, 'number');

  // Global withdrawal exception after assignment: Candidate 1 withdraws -> status becomes 'withdrawn' & assignment becomes 'revoked'
  const withdrawRes = await api(`/applications/${app1Id}/withdraw`, {
    method: 'POST',
    token: cand1Token,
    body: { reason: 'Em bận lịch học đột xuất' },
  });
  assert.equal(withdrawRes.status, 200);
  assert.equal(withdrawRes.data.application.status, 'withdrawn');
  assert.equal(withdrawRes.data.application.assignment.status, 'revoked');
  assert.equal(withdrawRes.data.quotaRestored, true);
});

test('Edge Cases: Missing info supplement loop, expired deadline, min_scorecards_per_interview = 2, and quota overflow', async () => {
  const adminToken = await loginAs('admin@cres.due.udn.vn');
  const hrToken = await loginAs('hr@cres.due.udn.vn');
  const bcn1Token = await loginAs('bcn@cres.due.udn.vn');
  const bcn2Token = await loginAs('pho.bcn@cres.due.udn.vn');

  await api('/admin/seed', {
    method: 'POST',
    token: adminToken,
    body: { mode: 'empty' },
  });

  // 1. Missing fields -> needs_supplement -> supplement round 1 -> still missing -> supplement round 2 -> still missing -> expired_supplement
  const regSupp = await api('/auth/register', {
    method: 'POST',
    body: { full_name: 'Phạm Văn Bổ Sung', email: 'bosung@due.udn.vn', password: 'password123' },
  });
  const suppToken = regSupp.data.token as string;

  const missingSubmit = await api('/applications', {
    method: 'POST',
    token: suppToken,
    body: {
      full_name: 'Phạm Văn Bổ Sung',
      student_id: '231121521333',
      class_name: '49K01.1',
      email: 'bosung@due.udn.vn',
      phone: '', // missing phone
      first_choice_dept_id: 'dept-media',
      experience: 'Có kinh nghiệm tổ chức',
      essay: '', // missing essay
      commitment_confirmed: true,
    },
  });
  assert.equal(missingSubmit.status, 201);
  assert.equal(missingSubmit.data.application.status, 'needs_supplement');
  assert.equal(missingSubmit.data.application.supplement_count, 0);
  const suppAppId = missingSubmit.data.application.id as string;

  // Supplement #1 (still missing essay) -> stays in needs_supplement with supplement_count = 1
  const supp1Res = await api(`/applications/${suppAppId}/supplement`, {
    method: 'PUT',
    token: suppToken,
    body: {
      phone: '0905666777',
      essay: '',
    },
  });
  assert.equal(supp1Res.status, 200);
  assert.equal(supp1Res.data.application.status, 'needs_supplement');
  assert.equal(supp1Res.data.application.supplement_count, 1);

  // Advance +3 days via time-travel -> expires supplement deadline -> transitions to expired_supplement
  const travelRes = await api('/admin/time-travel', {
    method: 'POST',
    token: adminToken,
    body: { days: 3 },
  });
  assert.equal(travelRes.status, 200);
  assert.equal(travelRes.data.scanResult.expiredSupplementsCount, 1);

  const afterExpire = await api(`/applications/${suppAppId}`, { token: suppToken });
  assert.equal(afterExpire.data.application.status, 'expired_supplement');

  // 2. Configure min_scorecards_per_interview = 2 and all 3 department quotas = 0 to test insufficient scorecards & quota overflow
  const cfgRes = await api('/admin/settings', {
    method: 'PUT',
    token: adminToken,
    body: {
      round: { min_scorecards_per_interview: 2 },
      departments: [
        { id: 'dept-media', name: 'Ban Truyền thông', quota: 0, description: '' },
        { id: 'dept-hr', name: 'Ban Nhân sự', quota: 0, description: '' },
        { id: 'dept-business', name: 'Ban Kinh doanh', quota: 0, description: '' },
      ],
    },
  });
  assert.equal(cfgRes.status, 200);

  const regMulti = await api('/auth/register', {
    method: 'POST',
    body: { full_name: 'Hoàng Thị Hai Phiếu', email: 'haiphieu@due.udn.vn', password: 'password123' },
  });
  const multiToken = regMulti.data.token as string;

  const multiSubmit = await api('/applications', {
    method: 'POST',
    token: multiToken,
    body: {
      full_name: 'Hoàng Thị Hai Phiếu',
      student_id: '231121521444',
      class_name: '49K01.1',
      email: 'haiphieu@due.udn.vn',
      phone: '0905888999',
      first_choice_dept_id: 'dept-media',
      second_choice_dept_id: 'dept-hr',
      experience:
        'Đã từng tham gia tổ chức sự kiện hội thảo sinh viên, thiết kế Canva, Photoshop, viết bài truyền thông fanpage và điều phối hậu cần tại trường ĐH Kinh tế - ĐH Đà Nẵng.',
      essay: 'Em cam kết gắn bó lâu dài với Câu lạc bộ Thương mại C-RES.',
      cv_url: 'https://drive.google.com/file/d/cv-haiphieu',
      commitment_confirmed: true,
      is_active_student: true,
    },
  });
  assert.equal(multiSubmit.status, 201);
  const multiAppId = multiSubmit.data.application.id as string;
  assert.equal(multiSubmit.data.application.status, 'invited_to_book');

  const slotsRes = await api('/slots', { token: multiToken });
  const slotId = slotsRes.data.slots[slotsRes.data.slots.length - 1].id as string;
  const bookMultiRes = await api(`/applications/${multiAppId}/book`, {
    method: 'POST',
    token: multiToken,
    body: { slotId },
  });
  assert.equal(bookMultiRes.status, 200);

  // Check-in + 1st scorecard (when min_scorecards_per_interview = 2) -> must stay in 'interviewing' and block 'decide'
  await api(`/applications/${multiAppId}/check-in`, {
    method: 'POST',
    token: bcn1Token,
  });

  const card1Res = await api(`/applications/${multiAppId}/scorecards`, {
    method: 'POST',
    token: bcn1Token,
    body: {
      scores: {
        'crit-attitude': 8,
        'crit-skill': 8,
        'crit-problem': 8,
        'crit-teamwork': 8,
        'crit-culture': 8,
      },
      comment: 'Phiếu chấm thứ nhất',
    },
  });
  assert.equal(card1Res.status, 200);
  assert.equal(
    card1Res.data.application.status,
    'interviewing',
    'With min_scorecards=2, 1 scorecard + check-in must stay in interviewing'
  );

  const decideWith1Card = await api(`/selection/${multiAppId}/decide`, {
    method: 'POST',
    token: bcn1Token,
    body: { decision: 'pass' },
  });
  assert.equal(decideWith1Card.status, 400, 'Must block decision when only 1/2 scorecards submitted');

  // 2nd scorecard from BCN 2 -> converges to 'scored'
  const card2Res = await api(`/applications/${multiAppId}/scorecards`, {
    method: 'POST',
    token: bcn2Token,
    body: {
      scores: {
        'crit-attitude': 9,
        'crit-skill': 9,
        'crit-problem': 9,
        'crit-teamwork': 9,
        'crit-culture': 9,
      },
      comment: 'Phiếu chấm thứ hai',
      decision: 'pass',
    },
  });
  assert.equal(card2Res.status, 200);
  assert.equal(card2Res.data.application.status, 'decided_pass');

  await api('/selection/finalize', {
    method: 'POST',
    token: bcn1Token,
    body: { applicationIds: [multiAppId] },
  });
  await api(`/applications/${multiAppId}/confirm-join`, {
    method: 'POST',
    token: multiToken,
  });

  // All 3 departments have quota = 0 -> /assignments/suggest must not create an assignment and /assignments/confirm must reject with 400
  const suggestZeroQuota = await api('/assignments/suggest?refresh=true', { token: hrToken });
  assert.equal(suggestZeroQuota.status, 200);
  const candZeroQuota = suggestZeroQuota.data.candidates.find((c: { id: string }) => c.id === multiAppId);
  assert.equal(candZeroQuota.assignment, null);

  const confirmOverflowRes = await api('/assignments/confirm', {
    method: 'POST',
    token: hrToken,
    body: {
      assignments: [{ applicationId: multiAppId, departmentId: 'dept-media' }],
    },
  });
  assert.equal(confirmOverflowRes.status, 400);
  assert.match(confirmOverflowRes.data.error, /Vượt quá chỉ tiêu/);
});

