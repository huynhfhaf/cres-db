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
  FastForward,
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

  // Outbox, Templates & Threshold X/Y state
  const [outboxList, setOutboxList] = useState<NotificationItem[]>([]);
  const [templates, setTemplates] = useState<Record<string, { key: string; name: string; subject: string; body: string }>>({});
  const [selectedTplKey, setSelectedTplKey] = useState<string>('supplement_request');
  const [thresholdXInput, setThresholdXInput] = useState<number>(round.threshold_x);
  const [thresholdYInput, setThresholdYInput] = useState<number>(round.threshold_y);
  const [nearMarginInput, setNearMarginInput] = useState<number>(round.near_threshold_margin);

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

  const aiReqSeqRef = React.useRef(0);

  const loadAiAssignments = async (refreshAi = false) => {
    const reqId = ++aiReqSeqRef.current;
    setAiLoading(true);
    try {
      const res = await apiRequest(`/assignments/suggest${refreshAi ? '?refresh=true' : ''}`);
      if (reqId !== aiReqSeqRef.current) return;
      setAiCandidates(res.candidates || []);
      setCompletedAssigned(res.completedCandidates || []);
      setDeptQuotas(res.departments || []);
      setAiMessage(res.aiMessage || '');
      if (refreshAi) {
        setFeedback({ type: 'success', text: res.aiMessage || 'Đã cập nhật gợi ý phân ban từ AI.' });
      }
    } catch (err) {
      if (reqId !== aiReqSeqRef.current) return;
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi tải gợi ý phân ban',
      });
    } finally {
      if (reqId === aiReqSeqRef.current) {
        setAiLoading(false);
      }
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

  const broadcastStateSync = () => {
    try {
      localStorage.setItem('cres_data_sync_ts', String(Date.now()));
      window.dispatchEvent(new CustomEvent('cres-data-updated'));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadApplications();
  }, [statusFilter, deptFilter, searchQuery, minScore, sortBy, sortDir]);

  useEffect(() => {
    const handleSync = () => {
      loadApplications();
      if (activeTab === 'ai_assignment') {
        loadAiAssignments(false);
      } else if (activeTab === 'outbox') {
        loadOutbox();
      }
    };
    window.addEventListener('cres-data-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('cres-data-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [activeTab, statusFilter, deptFilter, searchQuery, minScore, sortBy, sortDir]);

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

  // Per To-Be & BTH 3.2: BCN decides interview pass/fail; HR reviews borderline docs & confirms department assignment.

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
        text: 'Bạn vui lòng nhập ghi chú nhận xét (tối thiểu 3 ký tự) trước khi xác nhận kết quả nhé.',
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
            ? 'Đã duyệt hồ sơ ĐẠT và gửi thư mời chọn lịch phỏng vấn đến bạn ứng viên!'
            : 'Đã ghi nhận kết quả vòng hồ sơ và gửi thư phản hồi đến bạn ứng viên.',
      });
      await loadApplications();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Chưa thể lưu kết quả duyệt hồ sơ',
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
              ? 'Bài tự luận thể hiện sự nhiệt huyết và phù hợp với Câu lạc bộ Thương mại C-RES'
              : 'Hồ sơ chưa đáp ứng đủ tiêu chí vòng đơn của đợt tuyển này'),
        }),
      });
      setFeedback({
        type: 'success',
        text:
          action === 'confirm_reject'
            ? 'Đã xác nhận kết quả và gửi thư cảm ơn đến bạn ứng viên.'
            : 'Đã duyệt ĐẠT hồ sơ và gửi thư mời chọn lịch phỏng vấn cho bạn ứng viên!',
      });
      await loadApplications();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Chưa thể xử lý hồ sơ này',
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
        text: `Đã gửi thư phản hồi kết quả vòng hồ sơ cho ${res.confirmedCount} bạn ứng viên.`,
      });
      await loadApplications();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Chưa thể gửi thông báo hàng loạt',
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
        text: err instanceof Error ? err.message : 'Chưa thể đổi ban phân công',
      });
    }
  };

  const handleConfirmAllAssignments = async () => {
    try {
      const firstAvailableDept = deptQuotas.find((d) => d.remainingQuota > 0)?.id || '';
      const payload = aiCandidates.map((c) => ({
        applicationId: c.id,
        departmentId:
          c.assignment?.department_id ||
          (deptQuotas.find((d) => d.id === c.first_choice_dept_id && d.remainingQuota > 0)
            ? c.first_choice_dept_id
            : firstAvailableDept),
      }));

      const missingDept = payload.find((p) => !p.departmentId);
      if (missingDept) {
        setFeedback({
          type: 'error',
          text: 'Chưa thể chốt phân công: Tất cả các ban hiện đã hết chỉ tiêu nhận CTV hoặc ứng viên chưa được chọn ban hợp lệ.',
        });
        return;
      }

      // Invalidate any older in-flight suggest request before confirming
      aiReqSeqRef.current += 1;
      setAiLoading(true);
      const res = await apiRequest('/assignments/confirm', {
        method: 'POST',
        body: JSON.stringify({ assignments: payload }),
      });
      if (res.departments) setDeptQuotas(res.departments);
      if (res.candidates) setAiCandidates(res.candidates);
      if (res.completedCandidates) setCompletedAssigned(res.completedCandidates);
      setAiLoading(false);

      setFeedback({
        type: 'success',
        text: `Đã chốt phân ban và gửi thư chào mừng chính thức đến ${res.confirmedCount} Cộng tác viên mới của Câu lạc bộ Thương mại C-RES!`,
      });
      await loadAiAssignments(false);
      await loadApplications();
      onRefreshGlobal();
      broadcastStateSync();
    } catch (err) {
      setAiLoading(false);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Chưa thể chốt phân công ban',
      });
    }
  };

  const handleSaveTemplateAndThresholds = async () => {
    try {
      await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          templates,
          round: {
            ...round,
            threshold_x: thresholdXInput,
            threshold_y: thresholdYInput,
            near_threshold_margin: nearMarginInput,
          },
        }),
      });
      setFeedback({
        type: 'success',
        text: `Đã lưu Mẫu thư thông báo và Ngưỡng sơ loại (X = ${thresholdXInput}đ, Y = ${thresholdYInput}đ, biên độ = ${nearMarginInput}đ).`,
      });
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Chưa thể lưu mẫu thư và ngưỡng X, Y',
      });
    }
  };

  const handleHrTimeTravel = async (days: number) => {
    try {
      const res = await apiRequest('/admin/time-travel', {
        method: 'POST',
        body: JSON.stringify({ days }),
      });
      const s = res.scanResult;
      setFeedback({
        type: 'success',
        text: `Đã chạy Timer +${days} ngày: Quá hạn bổ sung (${s.expiredSupplementsCount}), Nhắc đặt lịch 1 ngày (${s.remindedBookingCount}), Gạch tên quá 2 ngày (${s.droppedNoBookingCount}).`,
      });
      await loadApplications();
      onRefreshGlobal();
      broadcastStateSync();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi chạy Timer',
      });
    }
  };

  const needsReviewList = applications.filter((a) => a.status === 'needs_review');
  const nearThresholdList = applications.filter((a) => a.status === 'clear_fail');
  const rejectedDocsList = applications.filter((a) => a.status === 'rejected_docs');

  return (
    <div className="space-y-6">
      {/* Sub-navigation Bar for HR + Quick Timer Simulation */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('spreadsheet')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'spreadsheet'
                ? 'bg-[#F36F00] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            1. Sheet Hồ sơ ({applications.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setActiveTab('needs_review');
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'needs_review'
                ? 'bg-[#F36F00] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            2. Duyệt hồ sơ còn lại ({needsReviewList.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setActiveTab('near_threshold');
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'near_threshold'
                ? 'bg-[#F36F00] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            3. Hồ sơ cần được xem xét ({nearThresholdList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai_assignment')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'ai_assignment'
                ? 'bg-[#F36F00] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            4. Phân công 3 Ban (AI gợi ý)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('outbox')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'outbox'
                ? 'bg-[#F36F00] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            5. Mẫu thư và Ngưỡng
          </button>
        </div>

        <div className="flex items-center gap-1.5 pr-1">
          <button
            type="button"
            onClick={() => handleHrTimeTravel(1)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#1E293B] bg-slate-50 hover:border-[#F36F00] hover:text-[#F36F00] border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <FastForward className="w-3 h-3 text-[#F36F00]" />
            Timer +1 ngày (Nhắc lịch)
          </button>
          <button
            type="button"
            onClick={() => handleHrTimeTravel(2)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors whitespace-nowrap"
          >
            <FastForward className="w-3 h-3" />
            Timer +2 ngày (Quá hạn / Gạch tên)
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
                  <th className="py-2.5 px-3 text-right">Điểm hồ sơ</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3">Thời hạn</th>
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
                            Chi tiết
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

      {/* TAB 2: DUYỆT HỒ SƠ */}
      {activeTab === 'needs_review' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-bold text-slate-900">
              Duyệt hồ sơ còn lại ({needsReviewList.length})
            </h2>
          </div>

          {needsReviewList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              Hiện không có hồ sơ nào đang chờ duyệt.
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
                        Điểm hồ sơ: {app.screening_score}đ
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
                        Câu hỏi tự luận:
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

      {/* TAB 3: XEM LẠI HỒ SƠ "LOẠI RÕ" SÁT NGƯỠNG & TRUY VẾT LOẠI TỰ ĐỘNG */}
      {activeTab === 'near_threshold' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>
                  Hồ sơ cần được xem xét ({nearThresholdList.length})
                </span>
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Các hồ sơ có điểm sơ loại sát ngưỡng tối thiểu Y ({round.threshold_y - round.near_threshold_margin}đ ≤ Điểm &lt; {round.threshold_y}đ) được giữ lại để Ban Nhân sự xem xét trước khi chốt gửi thư không đạt.
              </p>
            </div>
            {nearThresholdList.length > 0 && (
              <button
                type="button"
                onClick={() => handleBatchConfirmNearThreshold(nearThresholdList.map((a) => a.id))}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Chốt & Gửi thông báo tất cả ({nearThresholdList.length} hồ sơ)
              </button>
            )}
          </div>

          {nearThresholdList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              Hiện không có hồ sơ "Loại rõ" sát ngưỡng nào đang chờ xem lại.
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
                      Điểm sơ loại: {app.screening_score}đ (Sát ngưỡng Y={round.threshold_y}đ)
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
                      Chốt Loại & Gửi thông báo không đạt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rejectedDocsList.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Danh sách Hồ sơ không đạt vòng đơn đã ghi nhật ký ({rejectedDocsList.length})
              </h3>
              <div className="divide-y divide-slate-200 text-xs">
                {rejectedDocsList.map((app) => (
                  <div key={app.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900">{app.full_name}</span>
                      <span className="font-mono text-slate-500 ml-2">
                        ({app.student_id} · Điểm sơ loại: {app.screening_score ?? 0}đ)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openApplicationDetail(app.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
                      >
                        Xem nhật ký điểm & lý do loại
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PHÂN CÔNG BAN */}
      {activeTab === 'ai_assignment' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <span>Phân công Ban cho Cộng tác viên mới</span>
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => loadAiAssignments(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  {aiLoading ? 'Đang cập nhật gợi ý...' : 'Cập nhật gợi ý phân ban'}
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

            {/* 3 Department Quota Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {deptQuotas.map((d) => {
                const completedForDept = completedAssigned.filter(
                  (c) => (c.assignment?.department_id || c.first_choice_dept_id) === d.id
                ).length;
                const actualAssignedCount = Math.max(d.assignedCount ?? 0, completedForDept);
                const actualRemainingQuota = Math.max(0, d.quota - actualAssignedCount);
                const pendingForDept = aiCandidates.filter(
                  (c) => (c.assignment?.department_id || c.first_choice_dept_id) === d.id
                ).length;
                const willExceed = pendingForDept > actualRemainingQuota;
                return (
                  <div
                    key={d.id}
                    className={`p-4 rounded-xl border ${
                      willExceed ? 'bg-red-50 border-red-300' : 'bg-[#F8FAFC] border-slate-200'
                    }`}
                  >
                    <div className="font-bold text-sm text-[#1E293B]">{d.name}</div>
                    <div className="flex items-center justify-between mt-1.5 text-xs tabular-nums">
                      <span className="text-slate-600">
                        Đã chốt:{' '}
                        <strong className={actualAssignedCount > 0 ? 'text-emerald-700' : 'text-slate-800'}>
                          {actualAssignedCount}/{d.quota}
                        </strong>
                      </span>
                      <span className="font-bold text-[#F36F00]">Còn nhận: {actualRemainingQuota}</span>
                    </div>
                    <div className="text-xs mt-1 text-slate-600">
                      Đang chờ duyệt vào ban: <strong>{pendingForDept}</strong> bạn
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pending Candidates Table */}
            {aiCandidates.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                Hiện không có ứng viên nào đang chờ phân ban.
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
                      const availableFirstChoice = deptQuotas.find(
                        (d) => d.id === cand.first_choice_dept_id && d.remainingQuota > 0
                      )?.id;
                      const fallbackAvailable = deptQuotas.find((d) => d.remainingQuota > 0)?.id || '';
                      const currentDeptId =
                        cand.assignment?.department_id || availableFirstChoice || fallbackAvailable;
                      const displayScore =
                        cand.selection_decision?.total_score ?? cand.screening_score ?? 0;
                      return (
                        <tr key={cand.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">{cand.full_name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {cand.student_id} · {cand.class_name}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-blue-700 tabular-nums">
                            {displayScore}đ
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-900">NV1: {cand.first_choice_name}</div>
                            {cand.second_choice_name && (
                              <div className="text-[11px] text-slate-500">NV2: {cand.second_choice_name}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-md">
                            <div className="font-semibold text-blue-800">
                              Gợi ý:{' '}
                              {cand.assignment?.ai_suggested_dept_name ||
                                (currentDeptId ? cand.first_choice_name : 'Chưa thể gợi ý (Hết chỉ tiêu)')}
                            </div>
                            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                              {cand.assignment?.ai_reason ||
                                (currentDeptId
                                  ? 'Khớp nguyện vọng 1 và điểm phỏng vấn.'
                                  : 'Tất cả các ban đã hết chỉ tiêu nhận CTV.')}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={currentDeptId}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleChangeCandidateDepartment(cand.id, e.target.value);
                                }
                              }}
                              aria-label={`Chọn ban phân công cho ${cand.full_name}`}
                              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              {!currentDeptId && (
                                <option value="">-- Hết chỉ tiêu (Cần tăng quota) --</option>
                              )}
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
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <span>Hộp thư đi mô phỏng (Outbox — {outboxList.length} thông báo đã ghi nhận)</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Chế độ mô phỏng nội bộ: Thông báo được lưu vào bảng Outbox trong SQLite và hiển thị trực tiếp trên cổng Ứng viên (không gửi email SMTP ra ngoài).
                </p>
              </div>
              <button
                type="button"
                onClick={loadOutbox}
                className="text-xs font-semibold text-blue-600 hover:underline shrink-0"
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

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            {/* Editable Thresholds X, Y right alongside Templates */}
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3">
              <div className="text-sm font-bold text-[#1E293B]">
                Chỉnh sửa Ngưỡng sơ loại X, Y (Không cần vẽ lại quy trình)
              </div>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label htmlFor="hr-cfg-x" className="block font-semibold text-slate-700 mb-1">
                    Ngưỡng Đạt rõ X:
                  </label>
                  <input
                    id="hr-cfg-x"
                    type="number"
                    value={thresholdXInput}
                    onChange={(e) => setThresholdXInput(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 font-mono font-bold border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="hr-cfg-y" className="block font-semibold text-slate-700 mb-1">
                    Ngưỡng Loại rõ Y:
                  </label>
                  <input
                    id="hr-cfg-y"
                    type="number"
                    value={thresholdYInput}
                    onChange={(e) => setThresholdYInput(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 font-mono font-bold border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="hr-cfg-margin" className="block font-semibold text-slate-700 mb-1">
                    Biên độ sát Y:
                  </label>
                  <input
                    id="hr-cfg-margin"
                    type="number"
                    value={nearMarginInput}
                    onChange={(e) => setNearMarginInput(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 font-mono font-bold border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
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
                      rows={7}
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
                    onClick={handleSaveTemplateAndThresholds}
                    className="w-full py-2.5 text-xs font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors"
                  >
                    Lưu Mẫu thư & Ngưỡng X, Y
                  </button>
                </div>
              )}
            </div>
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
                  <div className="text-slate-500">Điểm hồ sơ</div>
                  <div className="font-mono font-bold text-blue-700 mt-0.5">
                    {detailApp.screening_score !== null ? `${detailApp.screening_score}đ` : 'Chưa chấm'}
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
                  Lịch sử xử lý hồ sơ ({detailLogs.length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {detailLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                      <div className="text-slate-900 font-medium">{log.result}</div>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                        {new Date(log.created_at).toLocaleString('vi-VN')}
                      </span>
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
