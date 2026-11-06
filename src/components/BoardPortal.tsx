import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  ClipboardCheck,
  Award,
  Send,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { apiRequest } from '../api';
import type {
  InterviewSlot,
  ScoringCriterion,
  Department,
  Application,
  ApplicationStatus,
} from '../types';
import { StatusBadge } from './StatusBadge';

interface BoardPortalProps {
  onRefreshGlobal: () => void;
}

const PASSED_STATUSES: ApplicationStatus[] = [
  'decided_pass',
  'offer_sent',
  'confirmed_joined',
  'assigned',
  'completed',
];

const FAILED_STATUSES: ApplicationStatus[] = [
  'decided_fail',
  'failed_interview',
  'rejected_docs',
  'expired_supplement',
  'no_booking',
  'withdrawn',
];

const PENDING_SCORING_STATUSES: ApplicationStatus[] = [
  'booked',
  'interviewing',
  'scored',
];

export function isCandidatePassed(c: Pick<Application, 'status' | 'selection_decision'>): boolean {
  return PASSED_STATUSES.includes(c.status) || c.selection_decision?.decision === 'pass';
}

export function isCandidateFailed(c: Pick<Application, 'status' | 'selection_decision'>): boolean {
  return FAILED_STATUSES.includes(c.status) || c.selection_decision?.decision === 'fail';
}

export function isCandidatePendingScoring(c: Pick<Application, 'status' | 'selection_decision'>): boolean {
  return (
    PENDING_SCORING_STATUSES.includes(c.status) &&
    !isCandidatePassed(c) &&
    !isCandidateFailed(c)
  );
}

export function BoardPortal({ onRefreshGlobal }: BoardPortalProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'results' | 'slots'>('pending');
  const [resultFilter, setResultFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [candidates, setCandidates] = useState<Array<Application & { computed_total_score?: number }>>([]);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [minScorecards, setMinScorecards] = useState(1);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Slot Modal
  const [showNewSlotModal, setShowNewSlotModal] = useState(false);
  const [newSlot, setNewSlot] = useState({
    start_at: '2026-11-06T08:00',
    end_at: '2026-11-06T10:00',
    location_or_link: 'Phòng B204 - Đại học Kinh tế - Đại học Đà Nẵng',
    capacity: 6,
  });

  // Scorecard Grading Modal
  const [gradingApp, setGradingApp] = useState<Application | null>(null);
  const [scoresInput, setScoresInput] = useState<Record<string, number>>({});
  const [scoreComment, setScoreComment] = useState('');

  // Preview & Finalize Modal ("Chốt và gửi")
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const broadcastStateSync = () => {
    try {
      localStorage.setItem('cres_data_sync_ts', String(Date.now()));
      window.dispatchEvent(new CustomEvent('cres-data-updated'));
    } catch {
      // ignore storage errors
    }
  };

  const loadBoardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [slotsRes, summaryRes] = await Promise.all([
        apiRequest('/slots'),
        apiRequest('/selection/summary'),
      ]);
      setSlots(slotsRes.slots || []);
      setCandidates(summaryRes.candidates || []);
      setCriteria(summaryRes.criteria || []);
      setDepartments(summaryRes.departments || []);
      setMinScorecards(summaryRes.minScorecards || 1);
    } catch (err) {
      if (!silent) {
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'Chưa thể tải dữ liệu phỏng vấn',
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoardData(false);
  }, [loadBoardData]);

  useEffect(() => {
    const handleSync = () => {
      loadBoardData(true);
    };
    window.addEventListener('cres-data-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('cres-data-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadBoardData]);

  const openScorecardModal = async (appId: string) => {
    try {
      const res = await apiRequest(`/applications/${appId}`);
      const app: Application = res.application;
      setGradingApp(app);

      const defaultScores: Record<string, number> = {};
      for (const c of criteria) {
        defaultScores[c.id] = 8.5;
      }
      if (app.scorecards && app.scorecards.length > 0) {
        const lastCard = app.scorecards[app.scorecards.length - 1];
        setScoresInput({ ...defaultScores, ...lastCard.scores });
        setScoreComment(lastCard.comment || '');
      } else {
        setScoresInput(defaultScores);
        setScoreComment('Ứng viên tự tin, năng động, phù hợp với văn hóa Câu lạc bộ Thương mại C-RES.');
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể mở phiếu chấm điểm',
      });
    }
  };

  const handleSubmitScorecardWithDecision = async (
    decision?: 'pass' | 'fail' | 'waitlist'
  ) => {
    if (!gradingApp) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ application: Application }>(
        `/applications/${gradingApp.id}/scorecards`,
        {
          method: 'POST',
          body: JSON.stringify({
            scores: scoresInput,
            comment: scoreComment,
            decision,
          }),
        }
      );

      const updatedApp = res.application;
      // Immediately update local state so UI re-renders without waiting for cache
      if (updatedApp) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === updatedApp.id
              ? {
                  ...c,
                  ...updatedApp,
                  computed_total_score:
                    updatedApp.selection_decision?.total_score ?? c.computed_total_score,
                }
              : c
          )
        );
        setSlots((prev) =>
          prev.map((slot) => ({
            ...slot,
            bookings: slot.bookings?.map((b) =>
              b.application_id === updatedApp.id
                ? { ...b, status: updatedApp.status }
                : b
            ),
          }))
        );
      }

      const candidateName = gradingApp.full_name;
      setGradingApp(null);
      setFeedback({
        type: 'success',
        text:
          decision === 'pass'
            ? `Đã lưu điểm và chuyển ứng viên "${candidateName}" sang trạng thái ĐÃ ĐẬU (đã chuyển sang tab "Đã có kết quả").`
            : decision === 'fail'
            ? `Đã lưu điểm và chuyển ứng viên "${candidateName}" sang trạng thái ĐÃ LOẠI (đã chuyển sang tab "Đã có kết quả").`
            : `Đã lưu phiếu chấm điểm cho ứng viên "${candidateName}".`,
      });
      await loadBoardData(true);
      onRefreshGlobal();
      broadcastStateSync();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi nộp phiếu chấm điểm',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickCheckIn = async (appId: string) => {
    try {
      const res = await apiRequest<{ application: Application }>(`/applications/${appId}/check-in`, {
        method: 'POST',
      });
      if (res.application && gradingApp && gradingApp.id === appId) {
        setGradingApp(res.application);
      }
      setFeedback({ type: 'success', text: 'Đã ghi nhận Check-in phỏng vấn cho ứng viên.' });
      await loadBoardData(true);
      onRefreshGlobal();
      broadcastStateSync();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi check-in',
      });
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/slots', {
        method: 'POST',
        body: JSON.stringify(newSlot),
      });
      setShowNewSlotModal(false);
      setFeedback({ type: 'success', text: 'Đã tạo khung giờ phỏng vấn mới thành công.' });
      await loadBoardData(true);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi tạo khung giờ phỏng vấn',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecideCandidate = async (
    applicationId: string,
    decision: 'pass' | 'waitlist' | 'fail'
  ) => {
    const targetCandidate = candidates.find((c) => c.id === applicationId);
    const nextOptimisticStatus: ApplicationStatus =
      decision === 'pass' ? 'decided_pass' : decision === 'fail' ? 'decided_fail' : 'scored';

    // 1. Optimistic state update so candidate is immediately removed from "Chờ chấm điểm xét tuyển"
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === applicationId
          ? {
              ...c,
              status: nextOptimisticStatus,
              selection_decision: {
                id: c.selection_decision?.id || 'temp',
                application_id: c.id,
                total_score: c.computed_total_score ?? c.screening_score ?? 85,
                decision,
                decided_by: 'board',
                note:
                  decision === 'pass'
                    ? 'BCN xét chọn Đậu phỏng vấn'
                    : decision === 'waitlist'
                    ? 'Đưa vào danh sách Chờ xét / Dự bị'
                    : 'Chưa phù hợp chỉ tiêu đợt này',
                notified_at: null,
              },
            }
          : c
      )
    );
    setSlots((prev) =>
      prev.map((slot) => ({
        ...slot,
        bookings: slot.bookings?.map((b) =>
          b.application_id === applicationId ? { ...b, status: nextOptimisticStatus } : b
        ),
      }))
    );

    try {
      const res = await apiRequest<{ application: Application }>(
        `/selection/${applicationId}/decide`,
        {
          method: 'POST',
          body: JSON.stringify({
            decision,
            note:
              decision === 'pass'
                ? 'BCN xét chọn Đậu phỏng vấn'
                : decision === 'waitlist'
                ? 'Đưa vào danh sách Chờ xét / Dự bị'
                : 'Chưa phù hợp chỉ tiêu đợt này',
          }),
        }
      );

      if (res.application) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === applicationId
              ? {
                  ...c,
                  ...res.application,
                  computed_total_score:
                    res.application.selection_decision?.total_score ?? c.computed_total_score,
                }
              : c
          )
        );
      }

      const candName = targetCandidate?.full_name || 'Ứng viên';
      setFeedback({
        type: 'success',
        text:
          decision === 'pass'
            ? `Đã duyệt ĐẬU cho ứng viên "${candName}". Ứng viên đã được chuyển ngay sang tab "Đã có kết quả".`
            : decision === 'fail'
            ? `Đã chuyển ứng viên "${candName}" sang ĐÃ LOẠI. Ứng viên đã được chuyển ngay sang tab "Đã có kết quả".`
            : `Đã chuyển ứng viên "${candName}" về danh sách Chờ chấm điểm xét tuyển.`,
      });

      await loadBoardData(true);
      onRefreshGlobal();
      broadcastStateSync();
    } catch (err) {
      await loadBoardData(true);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi cập nhật kết quả xét tuyển',
      });
    }
  };

  const handleFinalizeAndNotify = async (targetIds?: string[]) => {
    setSubmitting(true);
    try {
      const res = await apiRequest('/selection/finalize-and-notify', {
        method: 'POST',
        body: JSON.stringify(targetIds && targetIds.length > 0 ? { applicationIds: targetIds } : {}),
      });
      setShowFinalizeModal(false);
      setFeedback({
        type: 'success',
        text: `Đã chốt kết quả và gửi thông báo thành công cho ${res.finalizedTotal} ứng viên (${res.passedCount} Đậu, ${res.failedCount} Rớt)!`,
      });
      await loadBoardData(true);
      onRefreshGlobal();
      broadcastStateSync();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi chốt và gửi thông báo',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const computeLiveModalScore = () => {
    if (!criteria.length) return 0;
    const totalWeight = criteria.reduce((acc, c) => acc + c.weight, 0);
    if (totalWeight <= 0) return 0;
    let sum = 0;
    for (const c of criteria) {
      const raw = Number(scoresInput[c.id] ?? 0);
      const clamped = Math.max(0, Math.min(c.max_score, raw));
      const normalized = c.max_score > 0 ? (clamped / c.max_score) * 100 : 0;
      sum += normalized * (c.weight / totalWeight);
    }
    return Math.round(sum * 100) / 100;
  };

  // Strictly filtered lists:
  // 1. "Chờ chấm điểm xét tuyển" ONLY shows Pending/Reviewing candidates (excludes Passed & Failed)
  const pendingScoringList = candidates.filter(isCandidatePendingScoring);

  // 2. "Đã có kết quả" shows candidates who are Passed ("Đã đậu") or Failed ("Đã loại")
  const decidedResultList = candidates.filter(
    (c) => isCandidatePassed(c) || isCandidateFailed(c)
  );
  const passedResultList = decidedResultList.filter(isCandidatePassed);
  const failedResultList = decidedResultList.filter(isCandidateFailed);

  const displayedResultList =
    resultFilter === 'pass'
      ? passedResultList
      : resultFilter === 'fail'
      ? failedResultList
      : decidedResultList;

  const pendingFinalizeList = candidates.filter(
    (c) => c.status === 'decided_pass' || c.status === 'decided_fail'
  );

  return (
    <div className="space-y-6">
      {/* Sub-navigation for BCN */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-[#F36F00] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            1. Chờ chấm điểm xét tuyển ({pendingScoringList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'results'
                ? 'bg-[#F36F00] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            2. Đã có kết quả ({decidedResultList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'slots'
                ? 'bg-[#F36F00] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            3. Lịch phỏng vấn theo ca ({slots.length} ca)
          </button>
        </div>

        <div className="flex items-center gap-2 pr-1">
          {pendingFinalizeList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFinalizeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              Xem trước & Gửi kết quả ({pendingFinalizeList.length} bạn)
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.text}</span>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            {activeTab === 'pending' && feedback.type === 'success' && (
              <button
                type="button"
                onClick={() => setActiveTab('results')}
                className="text-xs font-bold text-[#F36F00] hover:underline"
              >
                Xem tab Đã có kết quả →
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Quotas & Summary Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#F36F00]" />
              <span>
                BCN Chấm điểm & Xét tuyển — Câu lạc bộ Thương mại C-RES
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Đang chờ chấm điểm xét tuyển: <strong className="text-[#F36F00]">{pendingScoringList.length} ứng viên</strong> · Đã có kết quả: <strong className="text-emerald-700">{passedResultList.length} Đã đậu</strong>, <strong className="text-red-600">{failedResultList.length} Đã loại</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={pendingFinalizeList.length === 0}
              onClick={() => setShowFinalizeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Chốt và gửi thông báo ({pendingFinalizeList.length} bạn)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {departments.map((d) => (
            <div key={d.id} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs">
              <div className="font-bold text-sm text-[#1E293B]">{d.name}</div>
              <div className="text-slate-600 mt-1 tabular-nums">
                Đã phân công: <strong>{d.assigned_count || 0}</strong> / Chỉ tiêu: <strong>{d.quota}</strong> (Còn nhận{' '}
                <span className="text-[#F36F00] font-bold">{d.remaining_quota ?? d.quota}</span>)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TAB 1: CHỜ CHẤM ĐIỂM XÉT TUYỂN (STRICTLY ONLY PENDING / REVIEWING CANDIDATES) */}
      {activeTab === 'pending' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1E293B]">
              <Clock className="w-4 h-4 text-[#F36F00]" />
              <span>Danh sách Chờ chấm điểm xét tuyển ({pendingScoringList.length} ứng viên)</span>
            </div>
            <span className="text-xs text-slate-500">
              Khi bấm <strong>Cho Đậu</strong> hoặc <strong>Loại</strong>, ứng viên sẽ tự động chuyển ngay sang tab <strong>Đã có kết quả</strong>.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">Hạng</th>
                  <th className="py-2.5 px-3">Ứng viên</th>
                  <th className="py-2.5 px-3">Nguyện vọng 1 / 2</th>
                  <th className="py-2.5 px-3">Điểm danh & Phiếu chấm</th>
                  <th className="py-2.5 px-3 text-right">Điểm trung bình</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Thao tác xét tuyển</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Đang tải danh sách chờ chấm điểm xét tuyển...
                    </td>
                  </tr>
                ) : pendingScoringList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Tất cả ứng viên phỏng vấn đều đã được chấm điểm và xét kết quả. Bạn có thể xem tại tab <strong>"2. Đã có kết quả"</strong>.
                    </td>
                  </tr>
                ) : (
                  pendingScoringList.map((cand, index) => {
                    const checkedIn = Boolean(cand.booking?.checked_in_at);
                    const cardCount = cand.scorecards?.length || 0;

                    return (
                      <tr key={cand.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-700 tabular-nums">
                          #{index + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{cand.full_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {cand.student_id} · {cand.class_name}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-900">{cand.first_choice_name}</div>
                          {cand.second_choice_name && (
                            <div className="text-[11px] text-slate-500">NV2: {cand.second_choice_name}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5 text-[11px] font-mono">
                            <span className={checkedIn ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                              · Check-in: {checkedIn ? 'Đã có mặt' : 'Chưa check-in'}
                            </span>
                            <span className={cardCount >= minScorecards ? 'text-blue-700 font-semibold' : 'text-slate-500'}>
                              · Phiếu chấm: {cardCount}/{minScorecards} phiếu
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-sm tabular-nums">
                          {cardCount > 0 ? (
                            <span className="text-blue-700">{cand.computed_total_score?.toFixed(2)}đ</span>
                          ) : (
                            <span className="text-slate-400">Chưa chấm</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={cand.status} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {!checkedIn && (
                              <button
                                type="button"
                                onClick={() => handleQuickCheckIn(cand.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md whitespace-nowrap"
                              >
                                Check-in
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openScorecardModal(cand.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md whitespace-nowrap"
                            >
                              Chấm phiếu
                            </button>
                            <button
                              type="button"
                              disabled={!checkedIn || cardCount < minScorecards}
                              title={
                                !checkedIn || cardCount < minScorecards
                                  ? `Cần Check-in và đủ tối thiểu ${minScorecards} phiếu chấm trước khi quyết định Đậu/Rớt`
                                  : 'Duyệt ứng viên Đậu phỏng vấn'
                              }
                              onClick={() => handleDecideCandidate(cand.id, 'pass')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed rounded-md whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Chọn Đậu
                            </button>
                            <button
                              type="button"
                              disabled={!checkedIn || cardCount < minScorecards}
                              title={
                                !checkedIn || cardCount < minScorecards
                                  ? `Cần Check-in và đủ tối thiểu ${minScorecards} phiếu chấm trước khi quyết định Đậu/Rớt`
                                  : 'Đánh giá ứng viên Rớt phỏng vấn'
                              }
                              onClick={() => handleDecideCandidate(cand.id, 'fail')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-45 disabled:cursor-not-allowed rounded-md whitespace-nowrap"
                            >
                              <XCircle className="w-3 h-3" />
                              Chọn Rớt
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ĐÃ CÓ KẾT QUẢ (PASSED / FAILED CANDIDATES) */}
      {activeTab === 'results' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1E293B]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Danh sách Ứng viên Đã có kết quả ({decidedResultList.length} ứng viên)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setResultFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                  resultFilter === 'all'
                    ? 'bg-[#1E293B] text-white border-[#1E293B]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Tất cả ({decidedResultList.length})
              </button>
              <button
                type="button"
                onClick={() => setResultFilter('pass')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                  resultFilter === 'pass'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                Đã đậu ({passedResultList.length})
              </button>
              <button
                type="button"
                onClick={() => setResultFilter('fail')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                  resultFilter === 'fail'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                }`}
              >
                Đã loại ({failedResultList.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3">Ứng viên</th>
                  <th className="py-2.5 px-3">Nguyện vọng 1 / 2</th>
                  <th className="py-2.5 px-3 text-right">Điểm tổng hợp</th>
                  <th className="py-2.5 px-3">Kết quả xét tuyển</th>
                  <th className="py-2.5 px-3">Trạng thái hồ sơ</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {displayedResultList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Chưa có ứng viên nào trong danh mục kết quả này.
                    </td>
                  </tr>
                ) : (
                  displayedResultList.map((cand, index) => {
                    const passed = isCandidatePassed(cand);
                    return (
                      <tr key={cand.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-700 tabular-nums">
                          #{index + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{cand.full_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {cand.student_id} · {cand.class_name}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-900">{cand.first_choice_name}</div>
                          {cand.second_choice_name && (
                            <div className="text-[11px] text-slate-500">NV2: {cand.second_choice_name}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-sm tabular-nums text-blue-700">
                          {cand.computed_total_score !== null && cand.computed_total_score !== undefined
                            ? `${cand.computed_total_score.toFixed(2)}đ`
                            : '—'}
                        </td>
                        <td className="py-3 px-3">
                          {passed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Đã đậu
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-800 font-bold text-[11px]">
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                              Đã loại
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={cand.status} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {(cand.status === 'decided_pass' || cand.status === 'decided_fail') && (
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleFinalizeAndNotify([cand.id])}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-md whitespace-nowrap"
                              >
                                <Send className="w-3 h-3" />
                                Chốt & Gửi TB
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openScorecardModal(cand.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap"
                            >
                              Xem phiếu điểm
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecideCandidate(cand.id, 'waitlist')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md whitespace-nowrap"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Đưa về Chờ chấm
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INTERVIEW SLOTS & SCORECARDS */}
      {activeTab === 'slots' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#F36F00]" />
                <span>Lịch phỏng vấn & Chấm điểm theo ca (Chỉ hiển thị ứng viên chờ chấm)</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowNewSlotModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tạo khung giờ phỏng vấn mới
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slots.map((slot) => {
              const allSlotBookings = slot.bookings || [];
              const pendingSlotBookings = allSlotBookings.filter((b) =>
                PENDING_SCORING_STATUSES.includes(b.status)
              );
              const finishedSlotCount = allSlotBookings.length - pendingSlotBookings.length;

              return (
                <div key={slot.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900 tabular-nums">
                        {new Date(slot.start_at).toLocaleString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}{' '}
                        –{' '}
                        {new Date(slot.end_at).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">{slot.location_or_link}</div>
                    </div>
                    <span className="px-2.5 py-1 bg-orange-50 border border-orange-200 rounded-lg text-xs font-mono font-bold text-[#F36F00] tabular-nums">
                      Chờ chấm: {pendingSlotBookings.length} · Tổng đặt: {slot.booked_count || 0}/{slot.capacity}
                    </span>
                  </div>

                  {pendingSlotBookings.length === 0 ? (
                    <div className="text-xs text-slate-500 py-2 flex items-center justify-between">
                      <span>Không còn ứng viên nào đang chờ chấm điểm ở ca này.</span>
                      {finishedSlotCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('results')}
                          className="text-[#F36F00] font-semibold hover:underline"
                        >
                          Đã có kết quả ({finishedSlotCount} bạn) →
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingSlotBookings.map((b) => (
                        <div
                          key={b.booking_id}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{b.full_name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {b.student_id} · NV1: {b.first_choice_name} ·{' '}
                              {b.checked_in_at ? 'Đã check-in' : 'Chưa check-in'} · {b.scorecard_count} phiếu
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!b.checked_in_at && (
                              <button
                                type="button"
                                onClick={() => handleQuickCheckIn(b.application_id)}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded"
                              >
                                Check-in
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openScorecardModal(b.application_id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#F36F00] hover:bg-[#D96200] rounded"
                            >
                              <ClipboardCheck className="w-3 h-3" />
                              Chấm điểm
                            </button>
                          </div>
                        </div>
                      ))}
                      {finishedSlotCount > 0 && (
                        <div className="pt-1 text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Đã chuyển {finishedSlotCount} ứng viên của ca này sang danh sách Đã có kết quả.</span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('results')}
                            className="font-semibold text-[#F36F00] hover:underline"
                          >
                            Xem kết quả →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: SCORECARD GRADING FORM */}
      {gradingApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Phiếu chấm điểm phỏng vấn ${gradingApp.full_name}`}
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Phiếu chấm điểm phỏng vấn: {gradingApp.full_name}
                </h3>
                <p className="text-xs text-slate-600">
                  MSSV: {gradingApp.student_id} · NV1: {gradingApp.first_choice_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGradingApp(null)}
                aria-label="Đóng phiếu chấm điểm"
                className="p-1 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitScorecardWithDecision(undefined);
              }}
              className="space-y-4"
            >
              <div className="space-y-3">
                {criteria.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <label htmlFor={`crit-${c.id}`} className="text-xs font-semibold text-slate-900 block">
                        {c.name}
                      </label>
                      <span className="text-[11px] font-mono text-slate-500">
                        Trọng số: {c.weight}% · Thang điểm tối đa: {c.max_score}
                      </span>
                    </div>
                    <input
                      id={`crit-${c.id}`}
                      type="number"
                      step="0.5"
                      min="0"
                      max={c.max_score}
                      required
                      value={scoresInput[c.id] ?? 8}
                      onChange={(e) =>
                        setScoresInput({ ...scoresInput, [c.id]: Number(e.target.value) })
                      }
                      className="w-20 px-2.5 py-1.5 text-sm font-mono font-bold text-right border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                ))}
              </div>

              {/* Live Auto-Summed Score & Department Quota Reference */}
              <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-[#1E293B]">
                    Hệ thống tự cộng điểm (theo trọng số):{' '}
                    <span className="text-base font-mono text-[#F36F00]">
                      {computeLiveModalScore().toFixed(2)} / 100đ
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Chỉ tiêu Ban NV1 ({gradingApp.first_choice_name}):{' '}
                    <strong>
                      Còn{' '}
                      {departments.find((d) => d.id === gradingApp.first_choice_dept_id)?.remaining_quota ??
                        departments.find((d) => d.id === gradingApp.first_choice_dept_id)?.quota ??
                        7}{' '}
                      chỗ
                    </strong>
                    {gradingApp.second_choice_name ? ` · NV2: ${gradingApp.second_choice_name}` : ''}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="score-comment" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nhận xét thái độ & năng lực của ứng viên:
                </label>
                <textarea
                  id="score-comment"
                  rows={3}
                  value={scoreComment}
                  onChange={(e) => setScoreComment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  placeholder="Ghi chú thái độ, kỹ năng, mức độ cam kết của ứng viên..."
                />
              </div>

              {/* Parallel Check-in Status Notice */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                  gradingApp.booking?.checked_in_at
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div>
                  <strong>Trạng thái điểm danh (Song song với chấm điểm):</strong>{' '}
                  {gradingApp.booking?.checked_in_at
                    ? 'Đã Check-in (Đủ điều kiện hội tụ AND-join để chốt Đậu/Rớt)'
                    : 'Chưa Check-in — Bạn có thể Chỉ lưu điểm trước, hoặc bấm Check-in để chốt Đậu/Rớt ngay.'}
                </div>
                {!gradingApp.booking?.checked_in_at && (
                  <button
                    type="button"
                    onClick={() => handleQuickCheckIn(gradingApp.id)}
                    className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded shrink-0"
                  >
                    Check-in ngay
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setGradingApp(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    {submitting ? 'Đang lưu...' : 'Chỉ lưu điểm'}
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !gradingApp.booking?.checked_in_at}
                    title={
                      !gradingApp.booking?.checked_in_at
                        ? 'Vui lòng Check-in ứng viên trước khi quyết định Đậu/Rớt'
                        : 'Lưu phiếu điểm và đánh giá Rớt'
                    }
                    onClick={() => handleSubmitScorecardWithDecision('fail')}
                    className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Lưu & Chọn Rớt
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !gradingApp.booking?.checked_in_at}
                    title={
                      !gradingApp.booking?.checked_in_at
                        ? 'Vui lòng Check-in ứng viên trước khi quyết định Đậu/Rớt'
                        : 'Lưu phiếu điểm và duyệt Đậu'
                    }
                    onClick={() => handleSubmitScorecardWithDecision('pass')}
                    className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Lưu & Duyệt Đậu
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PREVIEW & FINALIZE SELECTION RESULTS ("CHỐT VÀ GỬI") */}
      {showFinalizeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Xem trước và chốt gửi thông báo kết quả phỏng vấn"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Xác nhận gửi thông báo kết quả phỏng vấn
                </h3>
                <p className="text-xs text-slate-600">
                  Vui lòng kiểm tra lại danh sách ứng viên bên dưới trước khi gửi thông báo kết quả.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                aria-label="Đóng màn hình xem trước"
                className="p-1 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {pendingFinalizeList.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                    c.status === 'decided_pass'
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-red-50/70 border-red-200'
                  }`}
                >
                  <div>
                    <span className="font-bold text-slate-900">{c.full_name}</span>
                    <span className="font-mono text-slate-600 ml-2">
                      ({c.email} · NV1: {c.first_choice_name})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono font-bold tabular-nums">
                    <span>{c.computed_total_score?.toFixed(2)}đ</span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        c.status === 'decided_pass'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {c.status === 'decided_pass' ? 'GỬI THƯ ĐẬU' : 'GỬI THƯ RỚT'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
              >
                Quay lại chỉnh sửa
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFinalizeAndNotify()}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Đang gửi...' : `Chốt và gửi (${pendingFinalizeList.length} thông báo)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE NEW INTERVIEW SLOT */}
      {showNewSlotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tạo khung giờ phỏng vấn mới"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Tạo khung giờ phỏng vấn mới</h3>
            <form onSubmit={handleCreateSlot} className="space-y-3 text-xs">
              <div>
                <label htmlFor="slot-start" className="block font-semibold text-slate-700 mb-1">
                  Thời gian bắt đầu:
                </label>
                <input
                  id="slot-start"
                  type="datetime-local"
                  required
                  value={newSlot.start_at}
                  onChange={(e) => setNewSlot({ ...newSlot, start_at: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label htmlFor="slot-end" className="block font-semibold text-slate-700 mb-1">
                  Thời gian kết thúc:
                </label>
                <input
                  id="slot-end"
                  type="datetime-local"
                  required
                  value={newSlot.end_at}
                  onChange={(e) => setNewSlot({ ...newSlot, end_at: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label htmlFor="slot-loc" className="block font-semibold text-slate-700 mb-1">
                  Địa điểm phòng hoặc Link Google Meet:
                </label>
                <input
                  id="slot-loc"
                  type="text"
                  required
                  value={newSlot.location_or_link}
                  onChange={(e) => setNewSlot({ ...newSlot, location_or_link: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="slot-cap" className="block font-semibold text-slate-700 mb-1">
                  Sức chứa tối đa (số ứng viên):
                </label>
                <input
                  id="slot-cap"
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={newSlot.capacity}
                  onChange={(e) => setNewSlot({ ...newSlot, capacity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewSlotModal(false)}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg"
                >
                  Tạo khung giờ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
