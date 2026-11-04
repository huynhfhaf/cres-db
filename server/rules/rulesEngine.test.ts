import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRequiredFields,
  screenByThreshold,
  isNearThreshold,
  computeTotalScore,
  canBook,
  shouldRemind,
  shouldDrop,
  canConvergeInterviewAndJoin,
  isValidStateTransition,
  fallbackAssignmentSuggestion,
} from './rulesEngine';

test('checkRequiredFields identifies missing mandatory fields accurately', () => {
  const incomplete = checkRequiredFields({
    full_name: 'Nguyễn Văn A',
    student_id: '211121521101',
    class_name: '47K01.1',
    email: 'vana@due.udn.vn',
    phone: '',
    first_choice_dept_id: 'dept-1',
    experience: 'Đã tham gia CLB',
    essay: '   ',
  });
  assert.equal(incomplete.isComplete, false);
  assert.deepEqual(incomplete.missingFields, ['phone', 'essay']);

  const complete = checkRequiredFields({
    full_name: 'Nguyễn Văn A',
    student_id: '211121521101',
    class_name: '47K01.1',
    email: 'vana@due.udn.vn',
    phone: '0905123456',
    first_choice_dept_id: 'dept-1',
    experience: 'Đã tham gia CLB',
    essay: 'Em mong muốn đóng góp cho C-res',
  });
  assert.equal(complete.isComplete, true);
  assert.equal(complete.missingFields.length, 0);
});

test('screenByThreshold routes into clear_pass, needs_review, and clear_fail', () => {
  // X = 75, Y = 50
  assert.equal(screenByThreshold(80, true, 75, 50), 'clear_pass');
  assert.equal(screenByThreshold(75, true, 75, 50), 'clear_pass');
  assert.equal(screenByThreshold(65, true, 75, 50), 'needs_review');
  assert.equal(screenByThreshold(50, true, 75, 50), 'needs_review');
  assert.equal(screenByThreshold(48, true, 75, 50), 'clear_fail');
  // Violated hard condition forces clear_fail even with high score
  assert.equal(screenByThreshold(90, false, 75, 50), 'clear_fail');
});

test('isNearThreshold detects clear_fail scores within configured margin of Y', () => {
  // Y = 50, margin = 5 -> [45, 50) is near threshold if hardConditionsPassed
  assert.equal(isNearThreshold(47, true, 50, 5), true);
  assert.equal(isNearThreshold(45, true, 50, 5), true);
  assert.equal(isNearThreshold(44, true, 50, 5), false);
  assert.equal(isNearThreshold(50, true, 50, 5), false);
  assert.equal(isNearThreshold(48, false, 50, 5), false);
});

test('computeTotalScore calculates weighted normalized score across multiple scorecards', () => {
  const criteria = [
    { id: 'c1', weight: 60, max_score: 10 },
    { id: 'c2', weight: 40, max_score: 10 },
  ];
  const scorecards = [
    { scores: { c1: 8, c2: 9 } }, // 80*0.6 + 90*0.4 = 48 + 36 = 84
    { scores: { c1: 9, c2: 7 } }, // 90*0.6 + 70*0.4 = 54 + 28 = 82
  ];
  assert.equal(computeTotalScore(scorecards, criteria), 83);
});

test('canBook enforces slot capacity, duplicate booking, and start time', () => {
  const now = '2026-11-03T09:00:00.000Z';
  const openSlot = {
    id: 'slot-1',
    capacity: 5,
    booked_count: 3,
    start_at: '2026-11-05T09:00:00.000Z',
  };
  assert.equal(canBook(openSlot, null, now).allowed, true);
  assert.equal(canBook(openSlot, 'slot-1', now).allowed, false);

  const fullSlot = { ...openSlot, booked_count: 5 };
  assert.equal(canBook(fullSlot, null, now).allowed, false);
});

test('shouldRemind and shouldDrop evaluate 1-day and 2-day timers accurately', () => {
  const sentAt = '2026-11-01T08:00:00.000Z';
  const deadlineAt = '2026-11-03T08:00:00.000Z';
  const app = {
    status: 'invited_to_book' as const,
    schedule_link_sent_at: sentAt,
    schedule_reminded_at: null,
    schedule_deadline_at: deadlineAt,
  };

  const after1Day = new Date('2026-11-02T09:00:00.000Z').getTime();
  assert.equal(shouldRemind(app, 1, after1Day), true);
  assert.equal(shouldDrop(app, after1Day), false);

  // Already reminded -> never remind again
  assert.equal(
    shouldRemind({ ...app, schedule_reminded_at: '2026-11-02T09:00:00.000Z' }, 1, after1Day),
    false
  );

  const after2Days = new Date('2026-11-03T08:01:00.000Z').getTime();
  assert.equal(shouldDrop(app, after2Days), true);
});

test('canConvergeInterviewAndJoin requires both check-in and minimum scorecards', () => {
  assert.equal(canConvergeInterviewAndJoin(null, 2, 1), false);
  assert.equal(canConvergeInterviewAndJoin('2026-11-03T10:00:00Z', 0, 1), false);
  assert.equal(canConvergeInterviewAndJoin('2026-11-03T10:00:00Z', 1, 1), true);
});

test('fallbackAssignmentSuggestion respects department quotas and candidate preferences', () => {
  const candidates = [
    { applicationId: 'a1', fullName: 'A', totalScore: 92, firstChoiceDeptId: 'd1', secondChoiceDeptId: 'd2' },
    { applicationId: 'a2', fullName: 'B', totalScore: 85, firstChoiceDeptId: 'd1', secondChoiceDeptId: 'd2' },
  ];
  const depts = [
    { id: 'd1', name: 'Truyền thông', remainingQuota: 1 },
    { id: 'd2', name: 'Hậu cần', remainingQuota: 2 },
  ];
  const assigned = fallbackAssignmentSuggestion(candidates, depts);
  assert.equal(assigned.find((x) => x.applicationId === 'a1')?.departmentId, 'd1');
  assert.equal(assigned.find((x) => x.applicationId === 'a2')?.departmentId, 'd2');
});

test('isValidStateTransition enforces state machine rules and allows withdrawal before end', () => {
  assert.equal(isValidStateTransition('submitted', 'checking'), true);
  assert.equal(isValidStateTransition('submitted', 'completed'), false);
  assert.equal(isValidStateTransition('invited_to_book', 'withdrawn'), true);
  assert.equal(isValidStateTransition('completed', 'withdrawn'), false);
});
