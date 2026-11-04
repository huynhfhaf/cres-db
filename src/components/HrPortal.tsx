import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Mail,
  Eye,
  X,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../api';
import type {
  Application,
  Department,
  RecruitmentRound,
  NotificationItem,
  AuditLogItem,
} from '../types';
import { STATUS_LABELS } from '../types';
import { StatusBadge, EndReasonBadge, formatRemainingTime } from './StatusBadge';

interface HrPortalProps {
  round: RecruitmentRound;
  departments: Department[];
  systemNow: string;
  onRefreshGlobal: () => void;
}

export function HrPortal({
  round,
  departments,
  systemNow,
  onRefreshGlobal,
}: HrPortalProps) {
  const [activeTab, setActiveTab] = useState<
    'spreadsheet' | 'needs_review' | 'near_threshold' | 'ai_assignment' | 'outbox'
  >('spreadsheet');

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters & Sorting for Spreadsheet
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sortBy, setSortBy] = useState('submitted_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail Drawer Modal
  const [detailApp, setDetailApp] = useState<Application | null>(null);
  const [detailLogs, setDetailLogs] = useState<AuditLogItem[]>([]);

  // Review reason inputs per candidate
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});

  // AI Assignment state
  const [aiCandidates, setAiCandidates] = useState<Application[]>([]);
  const [completedAssigned, setCompletedAssigned] = useState<Application[]>([]);
  const [deptQuotas, setDeptQuotas] = useState<
    Array<{ id: string; name: string; quota: number; assignedCount: number; remainingQuota: number }>
  >([]);
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Outbox & Templates state
  const [outboxList, setOutboxList] = useState<NotificationItem[]>([]);
  const [templates, setTemplates] = useState<Record<string, { key: string; name: string; subject: string; body: string }>>({});
  const [selectedTplKey, setSelectedTplKey] = useState<string>('supplement_request');

  const loadApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        deptId: deptFilter,
        search: searchQuery,
        minScore,
        sortBy,
        sortDir,
      });
      const res = await apiRequest<{ applications: Application[] }>(`/applications?${params.toString()}`);
      setApplications(res.applications || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi tải danh sách hồ sơ',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAiAssignments = async (refreshAi = false) => {
    setAiLoading(true);
    try {
      const res = await apiRequest(`/assignments/suggest${refreshAi ? '?refresh=true' : ''}`);
      setAiCandidates(res.candidates || []);
      setCompletedAssigned(res.completedCandidates || []);
      setDeptQuotas(res.departments || []);
      setAiMessage(res.aiMessage || '');
      if (refreshAi) {
        setFeedback({ type: 'success', text: res.aiMessage || 'Đã cập nhật gợi ý phân ban từ AI.' });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi tải gợi ý phân ban',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const loadOutbox = async () => {
    try {
      const res = await apiRequest('/notifications');
      setOutboxList(res.notifications || []);
      if (res.templates) {
        setTemplates(res.templates);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadApplications();
  }, [statusFilter, deptFilter, searchQuery, minScore, sortBy, sortDir]);

  useEffect(() => {
    if (activeTab === 'ai_assignment') {
      loadAiAssignments(false);
    } else if (activeTab === 'outbox') {
      loadOutbox();
    }
  }, [activeTab]);

  const openApplicationDetail = async (id: string) => {
    try {
      const res = await apiRequest(`/applications/${id}`);
      setDetailApp(res.application);
      setDetailLogs(res.auditLogs || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể mở chi tiết hồ sơ',
      });
    }
  };

  const handleExportCsv = () => {
    const targetRows =
      selectedIds.length > 0
        ? applications.filter((a) => selectedIds.includes(a.id))
        : applications;

    const headers = [
      'ID',
      'Họ và tên',
      'MSSV',
      'Lớp',
      'Email',
      'SĐT',
      'Nguyện vọng 1',
      'Nguyện vọng 2',
      'Điểm sơ loại',
      'Trạng thái',
      'Số lần bổ sung',
      'Thời gian nộp',
    ];

    const csvLines = [
      headers.join(','),
      ...targetRows.map((a) =>
        [
          a.id,
          `"${(a.full_name || '').replace(/"/g, '""')}"`,
          `"${a.student_id || ''}"`,
          `"${a.class_name || ''}"`,
          `"${a.email || ''}"`,
          `"${a.phone || ''}"`,
          `"${a.first_choice_name || ''}"`,
          `"${a.second_choice_name || ''}"`,
          a.screening_score ?? '',
          `"${STATUS_LABELS[a.status] || a.status}"`,
          a.supplement_count,
          a.submitted_at,
        ].join(',')
      ),
    ];

    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cres-recruit-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleManualReview = async (appId: string, decision: 'pass' | 'fail') => {
    const reason = (reviewReasons[appId] || '').trim();
    if (reason.length < 3) {
      setFeedback({
        type: 'error',
        text: 'Vui lòng nhập lý do duyệt (tối thiểu 3 ký tự) trước khi chốt Đạt / Không đạt.',
      });
      return;
    }

    try {
      await apiRequest(`/applications/${appId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      });
      setFeedback({
        type: 'success',
        text:
          decision === 'pass'
            ? 'Đã duyệt ĐẠT và tự động gửi link đặt lịch phỏng vấn cho ứng viên!'
            : 'Đã duyệt KHÔNG ĐẠT và gửi thông báo kết thúc vòng hồ sơ.',
      });
      await loadApplications();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi duyệt hồ sơ',
      });
    }
  };

  const handleConfirmNearThreshold = async (appId: string, action: 'confirm_reject' | 'rescue_pass') => {
    try {
      await apiRequest(`/applications/${appId}/confirm-reject`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          reason:
            reviewReasons[appId] ||
            (action === 'rescue_pass'
              ? 'Bài tự luận thể hiện nhiệt huyết tốt dù điểm sát ngưỡng Y'
              : `Điểm sơ loại thấp hơn ngưỡng Y (${round.threshold_y}đ)`),
        }),
      });
      setFeedback({
        type: 'success',
        text:
          action === 'confirm_reject'
            ? 'Đã xác nhận loại hồ sơ gần ngưỡng và gửi thông báo cho ứng viên.'
            : 'Đã cứu hồ sơ gần ngưỡng sang ĐẠT và gửi link đặt lịch phỏng vấn.',
      });
      await loadApplications();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi xử lý hồ sơ gần ngưỡng',
      });
    }
  };

  const handleBatchConfirmNearThreshold = async (ids: string[]) => {
    try {
      const res = await apiRequest('/applications/batch-confirm-reject', {
        method: 'POST',
        body: JSON.stringify({ applicationIds: ids }),
      });
      setFeedback({
        type: 'success',
        text: `Đã xác nhận gửi thông báo loại hàng loạt cho ${res.confirmedCount} hồ sơ gần ngưỡng.`,
      });
      await loadApplications();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi xác nhận hàng loạt',
      });
    }
  };

  const handleChangeCandidateDepartment = async (applicationId: string, departmentId: string) => {
    try {
      await apiRequest(`/assignments/${applicationId}`, {
        method: 'PUT',
        body: JSON.stringify({ departmentId }),
      });
      await loadAiAssignments(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi đổi ban phân công',
      });
    }
  };

  const handleConfirmAllAssignments = async () => {
    try {
      const payload = aiCandidates.map((c) => ({
        applicationId: c.id,
        departmentId: c.assignment?.department_id || c.first_choice_dept_id,
      }));
      const res = await apiRequest('/assignments/confirm', {
        method: 'POST',
        body: JSON.stringify({ assignments: payload }),
      });
      setFeedback({
        type: 'success',
        text: `Đã chốt phân công ban và gửi thông báo hoàn tất cho ${res.confirmedCount} CTV mới!`,
      });
      await loadAiAssignments(false);
      await loadApplications();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi chốt phân công ban',
      });
    }
  };

  const handleSaveTemplate = async () => {
    try {
      await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ templates }),
      });
      setFeedback({ type: 'success', text: 'Đã lưu cấu hình mẫu thư tự động.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi lưu mẫu thư',
      });
    }
  };

  const needsReviewList = applications.filter((a) => a.status === 'needs_review');
  const nearThresholdList = applications.filter((a) => a.status === 'clear_fail');

  return (
    <div className="space-y-6">
      {/* Sub-navigation Bar for HR */}
      <div className="bg-white border border-[#435B61]/20 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('spreadsheet')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'spreadsheet'
                ? 'bg-[#F36F00] text-white'
                : 'text-[#435B61] hover:bg-[#F4F7F8]'
            }`}
          >
            1. Bảng Sheet Hồ sơ ({applications.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setActiveTab('needs_review');
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'needs_review'
                ? 'bg-[#68A225] text-white'
                : 'text-[#435B61] hover:bg-[#F4F7F8]'
            }`}
          >
            2. Hàng đợi Cần xem xét ({needsReviewList.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setActiveTab('near_threshold');
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'near_threshold'
                ? 'bg-[#FDD000] text-[#26383C]'
                : 'text-[#435B61] hover:bg-[#F4F7F8]'
            }`}
          >
            3. Loại rõ gần ngưỡng — Chờ xác nhận ({nearThresholdList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai_assignment')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'ai_assignment'
                ? 'bg-[#31B5D8] text-white'
                : 'text-[#435B61] hover:bg-[#F4F7F8]'
            }`}
          >
            4. Phân công Ban (AI gợi ý)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('outbox')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'outbox'
                ? 'bg-[#435B61] text-white'
                : 'text-[#435B61] hover:bg-[#F4F7F8]'
            }`}
          >
            5. Hộp thư đi (Outbox) & Mẫu thư
          </button>
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

      {/* TAB 1: SPREADSHEET VIEW */}
      {activeTab === 'spreadsheet' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm họ tên, MSSV, lớp, email..."
                  aria-label="Tìm kiếm ứng viên"
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Lọc theo trạng thái"
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                aria-label="Lọc theo ban nguyện vọng"
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">Tất cả các Ban</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="Điểm ≥ ..."
                aria-label="Điểm sơ loại tối thiểu"
                className="w-24 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
              />

              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [col, dir] = e.target.value.split(':');
                  setSortBy(col);
                  setSortDir((dir as 'asc' | 'desc') || 'desc');
                }}
                aria-label="Sắp xếp theo"
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="submitted_at:desc">Mới nộp nhất</option>
                <option value="screening_score:desc">Điểm sơ loại (Cao → Thấp)</option>
                <option value="screening_score:asc">Điểm sơ loại (Thấp → Cao)</option>
                <option value="full_name:asc">Họ tên (A → Z)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất CSV ({selectedIds.length > 0 ? `${selectedIds.length} dòng chọn` : 'Tất cả'})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả hồ sơ"
                      checked={applications.length > 0 && selectedIds.length === applications.length}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? applications.map((a) => a.id) : [])
                      }
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="py-2.5 px-3">Ứng viên</th>
                  <th className="py-2.5 px-3">MSSV · Lớp</th>
                  <th className="py-2.5 px-3">Nguyện vọng 1 / 2</th>
                  <th className="py-2.5 px-3 text-right">Điểm sơ loại</th>
                  <th className="py-2.5 px-3">Trạng thái luồng</th>
                  <th className="py-2.5 px-3">Bộ đếm giờ / Hạn</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Đang tải dữ liệu bảng Sheet...
                    </td>
                  </tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Không có hồ sơ nào khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => {
                    const activeDeadline = app.supplement_deadline_at || app.schedule_deadline_at;
                    const timerInfo = formatRemainingTime(activeDeadline, systemNow);
                    return (
                      <tr key={app.id} className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            aria-label={`Chọn hồ sơ ${app.full_name}`}
                            checked={selectedIds.includes(app.id)}
                            onChange={(e) =>
                              setSelectedIds((prev) =>
                                e.target.checked ? [...prev, app.id] : prev.filter((x) => x !== app.id)
                              )
                            }
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{app.full_name}</div>
                          <div className="text-[11px] text-slate-500">{app.email}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                          <div>{app.student_id || '—'}</div>
                          <div className="text-[11px] text-slate-500">{app.class_name}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{app.first_choice_name}</div>
                          {app.second_choice_name && (
                            <div className="text-[11px] text-slate-500">NV2: {app.second_choice_name}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                          {app.screening_score !== null ? (
                            <span
                              className={
                                app.screening_score >= round.threshold_x
                                  ? 'text-emerald-700'
                                  : app.screening_score < round.threshold_y
                                  ? 'text-red-600'
                                  : 'text-orange-600'
                              }
                            >
                              {app.screening_score}đ
                            </span>
                          ) : (
                            <span className="text-slate-400">Thiếu TT</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={app.status} />
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums">
                          {activeDeadline ? (
                            <span className={timerInfo.isOverdue ? 'text-red-600 font-bold' : 'text-amber-700'}>
                              {timerInfo.text}
                            </span>
                          ) : app.supplement_count > 0 ? (
                            <span className="text-slate-500">Bổ sung {app.supplement_count}/2</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => openApplicationDetail(app.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#146D85] bg-[#31B5D8]/12 hover:bg-[#31B5D8]/25 border border-[#31B5D8]/35 rounded-md transition-colors whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#31B5D8]" />
                            Chi tiết & Log
                          </button>
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

      {/* TAB 2: HÀNG ĐỢI CẦN XEM XÉT (MANUAL REVIEW) */}
      {activeTab === 'needs_review' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-bold text-slate-900">
              Bước 5: Duyệt hồ sơ nhánh "Cần xem xét" ({round.threshold_y}đ ≤ Điểm &lt; {round.threshold_x}đ)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Phần câu hỏi tự luận không chấm tự động bằng máy mà được hiển thị nguyên vẹn bên dưới để Ban Nhân sự đọc, đánh giá và ra quyết định Đạt hoặc Không đạt kèm lý do.
            </p>
          </div>

          {needsReviewList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              Tuyệt vời! Hiện không còn hồ sơ nào tồn đọng trong hàng đợi "Cần xem xét".
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {needsReviewList.map((app) => (
                <div key={app.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-bold text-slate-900">{app.full_name}</span>
                        <span className="text-xs font-mono text-slate-500">
                          {app.student_id} · {app.class_name}
                        </span>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Nguyện vọng 1: <strong>{app.first_choice_name}</strong>
                        {app.second_choice_name ? ` · Nguyện vọng 2: ${app.second_choice_name}` : ''}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <span className="px-3 py-1 bg-orange-50 border border-orange-200 rounded-lg text-xs font-bold text-orange-800">
                        Điểm sơ loại: {app.screening_score}đ (Giữa Y={round.threshold_y} và X={round.threshold_x})
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
                      <div className="font-semibold text-slate-700">Kinh nghiệm hoạt động:</div>
                      <p className="text-slate-800 leading-relaxed">{app.experience}</p>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3.5 space-y-1">
                      <div className="font-semibold text-blue-900">
                        Bài tự luận của ứng viên (Dành cho HR đọc duyệt):
                      </div>
                      <p className="text-slate-900 leading-relaxed">{app.essay}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <input
                      type="text"
                      value={reviewReasons[app.id] || ''}
                      onChange={(e) =>
                        setReviewReasons({ ...reviewReasons, [app.id]: e.target.value })
                      }
                      placeholder="Nhập lý do duyệt Đạt / Không đạt (Bắt buộc)..."
                      aria-label={`Lý do duyệt cho ${app.full_name}`}
                      className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleManualReview(app.id, 'pass')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Duyệt ĐẠT (Gửi link PV)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleManualReview(app.id, 'fail')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <XCircle className="w-4 h-4" />
                        Không đạt (Gửi thư loại)
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LOẠI RÕ GẦN NGƯỠNG — XEM LẠI TRƯỚC KHI GỬI */}
      {activeTab === 'near_threshold' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>
                  Hàng đợi "Loại rõ gần ngưỡng — HR xem lại trước khi gửi"
                </span>
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Các hồ sơ có điểm thấp hơn ngưỡng Y ({round.threshold_y}đ) nhưng nằm trong biên độ {round.near_threshold_margin} điểm ({round.threshold_y - round.near_threshold_margin}đ ≤ Điểm &lt; {round.threshold_y}đ) được giữ lại đây. Thông báo loại chỉ gửi sau khi HR bấm xác nhận.
              </p>
            </div>
            {nearThresholdList.length > 0 && (
              <button
                type="button"
                onClick={() => handleBatchConfirmNearThreshold(nearThresholdList.map((a) => a.id))}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Xác nhận gửi thông báo loại tất cả ({nearThresholdList.length} hồ sơ)
              </button>
            )}
          </div>

          {nearThresholdList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              Không có hồ sơ loại rõ gần ngưỡng nào đang chờ xác nhận gửi.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {nearThresholdList.map((app) => (
                <div key={app.id} className="bg-white border border-rose-200 rounded-xl p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="text-base font-bold text-slate-900">{app.full_name}</span>
                      <span className="text-xs font-mono text-slate-500 ml-2">
                        ({app.student_id} · {app.class_name} · NV1: {app.first_choice_name})
                      </span>
                    </div>
                    <span className="px-3 py-1 bg-rose-50 border border-rose-200 rounded-lg text-xs font-mono font-bold text-rose-800 tabular-nums">
                      Điểm sơ loại: {app.screening_score}đ (Cách ngưỡng Y={round.threshold_y}đ đúng{' '}
                      {round.threshold_y - (app.screening_score || 0)}đ)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <strong>Kinh nghiệm:</strong> {app.experience}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <strong>Tự luận:</strong> {app.essay}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmNearThreshold(app.id, 'rescue_pass')}
                      className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    >
                      Cứu xét sang ĐẠT (Gửi link PV)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmNearThreshold(app.id, 'confirm_reject')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Xác nhận Loại & Gửi thông báo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PHÂN CÔNG BAN (AI HỖ TRỢ - GEMINI API) */}
      {activeTab === 'ai_assignment' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <span>Bước 13–14: Phân công Vị trí / Ban (Có Gemini AI hỗ trợ gợi ý)</span>
                </h2>
                <p className="text-xs text-slate-600">
                  AI phân tích điểm phỏng vấn, nguyện vọng 1–2, kinh nghiệm và chỉ tiêu còn lại của từng ban để gợi ý. Gợi ý của AI không có hiệu lực cho đến khi HR kiểm tra, chỉnh sửa (nếu cần) và bấm "Chốt phân công và gửi".
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => loadAiAssignments(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  {aiLoading ? 'Đang gọi Gemini AI...' : 'Chạy lại gợi ý AI (Gemini)'}
                </button>
                <button
                  type="button"
                  disabled={aiLoading || aiCandidates.length === 0}
                  onClick={handleConfirmAllAssignments}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Chốt phân công và gửi ({aiCandidates.length} CTV)
                </button>
              </div>
            </div>

            {/* Department Quota Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {deptQuotas.map((d) => {
                const pendingForDept = aiCandidates.filter(
                  (c) => (c.assignment?.department_id || c.first_choice_dept_id) === d.id
                ).length;
                const willExceed = pendingForDept > d.remainingQuota;
                return (
                  <div
                    key={d.id}
                    className={`p-3.5 rounded-lg border ${
                      willExceed ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-900">{d.name}</div>
                    <div className="flex items-center justify-between mt-1.5 text-xs font-mono tabular-nums">
                      <span className="text-slate-600">
                        Đã chốt: {d.assignedCount}/{d.quota}
                      </span>
                      <span className="font-bold text-blue-700">Còn lại: {d.remainingQuota}</span>
                    </div>
                    <div className="text-[11px] mt-1 font-medium text-slate-600">
                      Đang dự kiến phân vào: <strong>{pendingForDept}</strong> ứng viên
                    </div>
                  </div>
                );
              })}
            </div>

            {aiMessage && (
              <div className="text-xs text-blue-900 bg-blue-50/80 border border-blue-200 rounded-lg px-4 py-2.5">
                <strong>Trạng thái AI:</strong> {aiMessage}
              </div>
            )}

            {/* Pending Candidates Table */}
            {aiCandidates.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                Hiện không có ứng viên nào ở trạng thái "Đã xác nhận vào nhóm — Chờ phân ban". (Các ứng viên đậu sau khi bấm Xác nhận tham gia nhóm sẽ xuất hiện tại đây).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                      <th className="py-2.5 px-3">Ứng viên</th>
                      <th className="py-2.5 px-3 text-right">Điểm PV</th>
                      <th className="py-2.5 px-3">Nguyện vọng 1 & 2</th>
                      <th className="py-2.5 px-3">AI Gợi ý & Lý do</th>
                      <th className="py-2.5 px-3">HR Chọn Ban Chốt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {aiCandidates.map((cand) => {
                      const currentDeptId =
                        cand.assignment?.department_id || cand.first_choice_dept_id;
                      return (
                        <tr key={cand.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">{cand.full_name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {cand.student_id} · {cand.class_name}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-blue-700 tabular-nums">
                            {cand.selection_decision?.total_score ?? cand.screening_score}đ
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-900">NV1: {cand.first_choice_name}</div>
                            {cand.second_choice_name && (
                              <div className="text-[11px] text-slate-500">NV2: {cand.second_choice_name}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-md">
                            <div className="font-semibold text-blue-800">
                              Gợi ý: {cand.assignment?.ai_suggested_dept_name || cand.first_choice_name}
                            </div>
                            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                              {cand.assignment?.ai_reason || 'Khớp nguyện vọng 1 và điểm phỏng vấn cao.'}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={currentDeptId}
                              onChange={(e) => handleChangeCandidateDepartment(cand.id, e.target.value)}
                              aria-label={`Chọn ban phân công cho ${cand.full_name}`}
                              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              {deptQuotas.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name} (Còn {d.remainingQuota} chỗ)
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Already Confirmed & Completed List */}
          {completedAssigned.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Danh sách CTV đã chốt phân công & hoàn tất quy trình ({completedAssigned.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {completedAssigned.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{c.full_name}</span>
                      <span className="font-mono text-emerald-700 font-semibold">
                        {c.assignment?.department_name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      MSSV: {c.student_id} · Điểm PV: {c.selection_decision?.total_score}đ
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: OUTBOX & EMAIL TEMPLATES */}
      {activeTab === 'outbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <span>Hộp thư đi (Outbox — {outboxList.length} thư đã gửi)</span>
              </h2>
              <button
                type="button"
                onClick={loadOutbox}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Làm mới
              </button>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {outboxList.map((n) => (
                <div key={n.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{n.subject}</span>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                      {new Date(n.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Người nhận: <strong className="text-slate-700">{n.candidate_name || n.to_email}</strong> ({n.to_email}) · Mẫu:{' '}
                    <span className="font-mono text-blue-700">{n.template_key}</span>
                  </div>
                  <p className="text-slate-700 whitespace-pre-line bg-white p-2.5 rounded border border-slate-200/80">
                    {n.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Cấu hình 10 Mẫu thư Tự động
            </h2>
            <p className="text-xs text-slate-600">
              Hỗ trợ các biến tự động: <code className="font-mono text-blue-700">{'{{full_name}}'}</code>,{' '}
              <code className="font-mono text-blue-700">{'{{link}}'}</code>,{' '}
              <code className="font-mono text-blue-700">{'{{deadline}}'}</code>,{' '}
              <code className="font-mono text-blue-700">{'{{department}}'}</code>
            </p>

            <div>
              <label htmlFor="tpl-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Chọn mẫu thư:
              </label>
              <select
                id="tpl-select"
                value={selectedTplKey}
                onChange={(e) => setSelectedTplKey(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
              >
                {Object.values(templates).map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name} ({t.key})
                  </option>
                ))}
              </select>
            </div>

            {templates[selectedTplKey] && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="tpl-subject" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tiêu đề thư (Subject):
                  </label>
                  <input
                    id="tpl-subject"
                    type="text"
                    value={templates[selectedTplKey].subject}
                    onChange={(e) =>
                      setTemplates({
                        ...templates,
                        [selectedTplKey]: { ...templates[selectedTplKey], subject: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="tpl-body" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nội dung thư (Body):
                  </label>
                  <textarea
                    id="tpl-body"
                    rows={8}
                    value={templates[selectedTplKey].body}
                    onChange={(e) =>
                      setTemplates({
                        ...templates,
                        [selectedTplKey]: { ...templates[selectedTplKey], body: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Lưu thay đổi mẫu thư
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPLICATION DETAIL & AUDIT LOG MODAL */}
      {detailApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Chi tiết hồ sơ ${detailApp.full_name}`}
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900">{detailApp.full_name}</h3>
                <StatusBadge status={detailApp.status} />
                <EndReasonBadge reason={detailApp.end_reason} />
              </div>
              <button
                type="button"
                onClick={() => setDetailApp(null)}
                aria-label="Đóng chi tiết hồ sơ"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <div className="text-slate-500">MSSV / Lớp</div>
                  <div className="font-mono font-semibold text-slate-900 mt-0.5">
                    {detailApp.student_id || 'Thiếu'} · {detailApp.class_name || 'Thiếu'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Liên hệ</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {detailApp.phone || 'Thiếu SĐT'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Điểm sơ loại</div>
                  <div className="font-mono font-bold text-blue-700 mt-0.5">
                    {detailApp.screening_score !== null ? `${detailApp.screening_score}đ (${detailApp.screening_result})` : 'Chưa chấm'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Nguyện vọng 1 / 2</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {detailApp.first_choice_name} {detailApp.second_choice_name ? `/ ${detailApp.second_choice_name}` : ''}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-semibold text-slate-700">Kinh nghiệm hoạt động:</div>
                  <p className="text-slate-800">{detailApp.experience || '(Trống)'}</p>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-semibold text-slate-700">Câu hỏi tự luận:</div>
                  <p className="text-slate-800">{detailApp.essay || '(Trống)'}</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">
                  Lịch sử Audit Log của Case ({detailLogs.length} sự kiện)
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {detailLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-blue-700">
                          {log.action} · Tác nhân: {log.actor}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="text-slate-900 font-medium">{log.result}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Luật áp dụng: {log.rule_applied}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
