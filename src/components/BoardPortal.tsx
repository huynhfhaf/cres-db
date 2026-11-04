import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  ClipboardCheck,
  Award,
  Send,
  UserCheck,
  X,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { apiRequest } from '../api';
import type {
  InterviewSlot,
  ScoringCriterion,
  Department,
  Application,
} from '../types';
import { StatusBadge } from './StatusBadge';

interface BoardPortalProps {
  onRefreshGlobal: () => void;
}

export function BoardPortal({ onRefreshGlobal }: BoardPortalProps) {
  const [activeTab, setActiveTab] = useState<'slots' | 'selection'>('selection');
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
    location_or_link: 'Phòng B204 - ĐH Kinh tế ĐHĐN',
    capacity: 6,
  });

  // Scorecard Grading Modal
  const [gradingApp, setGradingApp] = useState<Application | null>(null);
  const [scoresInput, setScoresInput] = useState<Record<string, number>>({});
  const [scoreComment, setScoreComment] = useState('');

  // Preview & Finalize Modal ("Chốt và gửi")
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadBoardData = async () => {
    setLoading(true);
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
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi tải dữ liệu Ban Chủ nhiệm',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoardData();
  }, []);

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
        setScoreComment('Ứng viên tự tin, nắm rõ định hướng sự kiện của CLB C-res.');
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể mở phiếu chấm điểm',
      });
    }
  };

  const handleSubmitScorecard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingApp) return;
    setSubmitting(true);
    try {
      await apiRequest(`/applications/${gradingApp.id}/scorecards`, {
        method: 'POST',
        body: JSON.stringify({
          scores: scoresInput,
          comment: scoreComment,
        }),
      });
      setGradingApp(null);
      setFeedback({
        type: 'success',
        text: `Đã lưu phiếu chấm điểm cho ${gradingApp.full_name}. Nếu ứng viên đã check-in, cổng AND-join sẽ tự động hội tụ sang bước Tổng hợp điểm!`,
      });
      await loadBoardData();
      onRefreshGlobal();
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
      await apiRequest(`/applications/${appId}/check-in`, { method: 'POST' });
      setFeedback({ type: 'success', text: 'Đã ghi nhận Check-in phỏng vấn cho ứng viên.' });
      await loadBoardData();
      onRefreshGlobal();
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
      await loadBoardData();
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
    try {
      await apiRequest(`/selection/${applicationId}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          note:
            decision === 'pass'
              ? 'BCN xét chọn Đậu phỏng vấn'
              : decision === 'waitlist'
              ? 'Đưa vào danh sách Dự bị'
              : 'Chưa phù hợp chỉ tiêu đợt này',
        }),
      });
      setFeedback({
        type: 'success',
        text: `Đã ghi nhận lựa chọn ${
          decision === 'pass' ? 'ĐẬU' : decision === 'waitlist' ? 'DỰ BỊ' : 'RỚT'
        }. Lưu ý: Thông báo chỉ gửi sau khi bạn bấm "Xem trước & Chốt gửi".`,
      });
      await loadBoardData();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi chọn kết quả',
      });
    }
  };

  const handleFinalizeAndNotify = async () => {
    setSubmitting(true);
    try {
      const res = await apiRequest('/selection/finalize-and-notify', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setShowFinalizeModal(false);
      setFeedback({
        type: 'success',
        text: `Đã chốt và gửi thông báo thành công cho ${res.finalizedTotal} ứng viên (${res.passedCount} Đậu, ${res.failedCount} Rớt)!`,
      });
      await loadBoardData();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi chốt và gửi thông báo',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingFinalizeList = candidates.filter(
    (c) => c.status === 'decided_pass' || c.status === 'decided_fail'
  );

  return (
    <div className="space-y-6">
      {/* Sub-navigation for BCN */}
      <div className="bg-white border border-[#435B61]/20 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('selection')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'selection'
                ? 'bg-[#31B5D8] text-white'
                : 'text-[#435B61] hover:bg-[#F4F7F8]'
            }`}
          >
            1. Tổng hợp điểm & Quyết định Đậu / Rớt ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'slots'
                ? 'bg-[#F36F00] text-white'
                : 'text-[#435B61] hover:bg-[#F4F7F8]'
            }`}
          >
            2. Khung giờ phỏng vấn & Phiếu chấm điểm ({slots.length} ca)
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
              Xem trước & Chốt gửi kết quả ({pendingFinalizeList.length} chờ gửi)
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
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline ml-4"
          >
            Đóng
          </button>
        </div>
      )}

      {/* TAB 1: SELECTION SUMMARY & RANKING BOARD */}
      {activeTab === 'selection' && (
        <div className="space-y-6">
          {/* Quotas & Weights Header */}
          <div className="bg-white border border-[#435B61]/20 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#26383C] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#F36F00]" />
                  <span>
                    Bước 10–11: Bảng xếp hạng điểm phỏng vấn có trọng số & Quyết định của Ban Chủ nhiệm
                  </span>
                </h2>
                <p className="text-xs text-[#435B61] mt-0.5">
                  Mỗi ứng viên hội tụ ngay khi đã Check-in và đủ ≥ {minScorecards} phiếu điểm. BCN tự quyết định Đậu / Dự bị / Rớt, sau đó bấm "Xem trước & Chốt gửi" để phát thông báo.
                </p>
              </div>
              <button
                type="button"
                disabled={pendingFinalizeList.length === 0}
                onClick={() => setShowFinalizeModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Chốt và gửi thông báo ({pendingFinalizeList.length} ứng viên)
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {departments.map((d) => (
                <div key={d.id} className="p-3 rounded-lg bg-white border border-[#435B61]/20 text-xs">
                  <div className="font-bold text-[#26383C]">{d.name}</div>
                  <div className="font-mono text-[#435B61] mt-1 tabular-nums">
                    Đã phân công: <strong>{d.assigned_count || 0}</strong> / Chỉ tiêu: <strong>{d.quota}</strong> (Còn{' '}
                    <span className="text-[#F36F00] font-bold">{d.remaining_quota ?? d.quota}</span>)
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ranked Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                    <th className="py-2.5 px-3">Hạng</th>
                    <th className="py-2.5 px-3">Ứng viên</th>
                    <th className="py-2.5 px-3">Nguyện vọng 1 / 2</th>
                    <th className="py-2.5 px-3">Hội tụ AND-join</th>
                    <th className="py-2.5 px-3 text-right">Điểm TB Trọng số</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3 text-right">Chấm điểm / Quyết định BCN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Đang tải bảng tổng hợp...
                      </td>
                    </tr>
                  ) : (
                    candidates.map((cand, index) => {
                      const checkedIn = Boolean(cand.booking?.checked_in_at);
                      const cardCount = cand.scorecards?.length || 0;
                      const isConverged = checkedIn && cardCount >= minScorecards;
                      const canDecide = ['scored', 'decided_pass', 'decided_fail'].includes(cand.status);

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
                              <span className="text-slate-400">—</span>
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

                              {canDecide && isConverged && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDecideCandidate(cand.id, 'pass')}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap ${
                                      cand.status === 'decided_pass'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-100 hover:bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    Chọn Đậu
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDecideCandidate(cand.id, 'waitlist')}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap ${
                                      cand.selection_decision?.decision === 'waitlist' && cand.status === 'scored'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-slate-100 hover:bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    Dự bị
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDecideCandidate(cand.id, 'fail')}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap ${
                                      cand.status === 'decided_fail'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-slate-100 hover:bg-red-100 text-red-800'
                                    }`}
                                  >
                                    Chọn Rớt
                                  </button>
                                </>
                              )}
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
        </div>
      )}

      {/* TAB 2: INTERVIEW SLOTS & SCORECARDS */}
      {activeTab === 'slots' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span>Quản lý Khung giờ phỏng vấn & Chấm điểm trực tiếp</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Tạo các khung giờ phỏng vấn để ứng viên tự chọn lịch. Mở phiếu chấm điểm cho từng ứng viên trong ca phỏng vấn.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewSlotModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tạo khung giờ phỏng vấn mới
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slots.map((slot) => (
              <div key={slot.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      {new Date(slot.start_at).toLocaleString('vi-VN')} –{' '}
                      {new Date(slot.end_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{slot.location_or_link}</div>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-mono font-bold text-blue-800 tabular-nums">
                    Đã đặt: {slot.booked_count || 0}/{slot.capacity}
                  </span>
                </div>

                {!slot.bookings || slot.bookings.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">Chưa có ứng viên nào đặt khung giờ này.</p>
                ) : (
                  <div className="space-y-2">
                    {slot.bookings.map((b) => (
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            Chấm điểm
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
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

            <form onSubmit={handleSubmitScorecard} className="space-y-4">
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

              <div>
                <label htmlFor="score-comment" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nhận xét của giám khảo:
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGradingApp(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {submitting ? 'Đang lưu...' : 'Nộp phiếu chấm điểm'}
                </button>
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
                  Màn hình Xem trước & Đối chiếu danh sách trước khi "Chốt và gửi"
                </h3>
                <p className="text-xs text-slate-600">
                  Mọi thông báo đã gửi không thể thu hồi. Vui lòng đối chiếu kỹ danh sách ứng viên Đậu và Rớt bên dưới trước khi bấm xác nhận.
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
                onClick={handleFinalizeAndNotify}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
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
                  className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
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
