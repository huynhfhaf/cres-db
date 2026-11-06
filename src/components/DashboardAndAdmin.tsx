import React, { useState, useEffect } from 'react';
import {
  FastForward,
  RotateCcw,
  Settings,
  BarChart3,
  Clock,
  Save,
  History,
  FlaskConical,
} from 'lucide-react';
import { apiRequest } from '../api';
import type {
  RecruitmentRound,
  Department,
  ScoringCriterion,
  AuditLogItem,
} from '../types';

interface DashboardAndAdminProps {
  mode: 'dashboard' | 'admin';
  onRefreshGlobal: () => void;
}

const CRES_LOGO_PATH = '/assets/aistudio/C-RES_C__VI_N__1__e8c78418.png';

interface ScreeningEvaluation {
  totalScore: number;
  score: number;
  scoreBreakdown: Record<string, number> | string[];
  hardConditionsPassed: boolean;
  violatedConditions: string[];
  branch: 'clear_pass' | 'needs_review' | 'clear_fail';
  nearThreshold: boolean;
  explanation: string;
}

interface ScreeningTestResponse {
  score: number;
  totalScore?: number;
  scoreBreakdown: Record<string, number> | string[];
  hardConditionsPassed: boolean;
  violatedConditions: string[];
  branch: 'clear_pass' | 'needs_review' | 'clear_fail';
  nearThreshold: boolean;
  explanation?: string;
  thresholdX: number;
  thresholdY: number;
  margin: number;
  evaluation?: ScreeningEvaluation;
}

export function DashboardAndAdmin({ mode, onRefreshGlobal }: DashboardAndAdminProps) {
  const [stats, setStats] = useState<any>(null);
  const [adminData, setAdminData] = useState<{
    round: RecruitmentRound;
    departments: Department[];
    criteria: ScoringCriterion[];
    hardConditions: {
      requireValidEmail: boolean;
      requireActiveStudentId: boolean;
      requireValidPhone: boolean;
      requireTimeCommitment: boolean;
    };
    timeScale: number;
    systemNow: string;
  } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmSeedMode, setConfirmSeedMode] = useState<'empty' | 'sample' | null>(null);
  const [testForm, setTestForm] = useState({
    email: 'ungvien@due.udn.vn',
    student_id: '231121521101',
    phone: '0905123456',
    class_name: '49K01.1',
    experience:
      'Từng tham gia tổ chức sự kiện tại trường, thiết kế Canva, viết bài truyền thông fanpage và điều phối hậu cần cho hội thảo sinh viên tại Đại học Kinh tế - ĐH Đà Nẵng. Em cam kết gắn bó lâu dài cùng Câu lạc bộ Thương mại C-RES.',
    cv_url: 'https://drive.google.com/file/d/cv-ungvien-cres',
    second_choice_dept_id: 'dept-er',
    commitment_confirmed: true,
    is_active_student: true,
  });
  const [testResult, setTestResult] = useState<ScreeningTestResponse | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statsRes, settingsRes, logsRes] = await Promise.all([
        apiRequest('/dashboard/stats'),
        apiRequest('/admin/settings'),
        apiRequest('/audit-logs'),
      ]);
      setStats(statsRes);
      setAdminData(settingsRes);
      setAuditLogs(logsRes.auditLogs || []);
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể tải dữ liệu thống kê',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [mode]);

  const handleTimeTravel = async (days: number) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await apiRequest('/admin/time-travel', {
        method: 'POST',
        body: JSON.stringify({ days }),
      });
      const s = res.scanResult;
      setBanner({
        type: 'success',
        text: `Đã chuyển thời gian sang +${days} ngày tiếp theo (${new Date(res.systemNow).toLocaleString(
          'vi-VN',
          { timeZone: 'Asia/Ho_Chi_Minh' }
        )}). Đã cập nhật ${s.expiredSupplementsCount} hồ sơ quá hạn bổ sung, gửi ${
          s.remindedBookingCount
        } thư nhắc chọn lịch phỏng vấn và khép lại ${s.droppedNoBookingCount} hồ sơ chưa đặt lịch.`,
      });
      await loadAll();
      onRefreshGlobal();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Chưa thể chuyển thời gian',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReseed = async (seedMode: 'empty' | 'sample') => {
    setBusy(true);
    setBanner(null);
    setConfirmSeedMode(null);
    try {
      const res = await apiRequest('/admin/seed', {
        method: 'POST',
        body: JSON.stringify({ mode: seedMode }),
      });
      setBanner({
        type: 'success',
        text:
          res.message ||
          (seedMode === 'sample'
            ? `Đã nạp dữ liệu mẫu thành công (${res.seededUsers ?? 17} tài khoản, ${res.seededApplications ?? 16} đơn ứng tuyển)!`
            : 'Đã đặt lại đợt tuyển trống thành công (0 hồ sơ)!'),
      });
      await loadAll();
      onRefreshGlobal();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Chưa thể làm mới dữ liệu',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminData) return;
    setBusy(true);
    setBanner(null);
    try {
      await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          round: adminData.round,
          departments: adminData.departments,
          criteria: adminData.criteria,
          hardConditions: adminData.hardConditions,
          timeScale: adminData.timeScale,
        }),
      });
      setBanner({
        type: 'success',
        text: 'Đã lưu thông tin cài đặt đợt tuyển và chỉ tiêu của 3 Ban thành công!',
      });
      await loadAll();
      onRefreshGlobal();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Chưa thể lưu cài đặt',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRunRuleTest = async () => {
    setBusy(true);
    try {
      const res = await apiRequest('/admin/test-screening', {
        method: 'POST',
        body: JSON.stringify(testForm),
      });
      setTestResult(res);
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể chạy kiểm thử luật',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !stats || !adminData) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-24 bg-slate-200/70 rounded-xl animate-pulse" />
        <div className="h-80 bg-slate-200/70 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time-Travel & Brand Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <img
            src={CRES_LOGO_PATH}
            alt="Logo Câu lạc bộ Thương mại C-RES"
            className="h-11 w-auto object-contain hidden sm:block shrink-0"
          />
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-[#1E293B]">
              Câu lạc bộ Thương mại C-RES · Đại học Kinh tế - Đại học Đà Nẵng
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F36F00] tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#F36F00]" />
              <span>
                Thời gian hiện tại:{' '}
                {new Date(adminData.systemNow).toLocaleString('vi-VN', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleTimeTravel(1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1E293B] bg-white hover:border-[#F36F00] hover:text-[#F36F00] border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <FastForward className="w-3.5 h-3.5 text-[#F36F00]" />
            Tua nhanh +1 ngày
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleTimeTravel(2)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors whitespace-nowrap"
          >
            <FastForward className="w-3.5 h-3.5" />
            Tua nhanh +2 ngày
          </button>

          {confirmSeedMode === null ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmSeedMode('empty')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Đặt lại đợt tuyển trống (0 hồ sơ)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmSeedMode('sample')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1E293B] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#F36F00]" />
                Nạp dữ liệu mẫu (17 ứng viên)
              </button>
            </>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs">
              <span className="font-semibold text-amber-950">
                {confirmSeedMode === 'empty'
                  ? 'Xác nhận xóa hết hồ sơ (về 0)?'
                  : 'Xác nhận nạp dữ liệu mẫu (17 ứng viên)?'}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleReseed(confirmSeedMode)}
                className="px-2.5 py-1 bg-[#F36F00] text-white font-bold rounded hover:bg-[#D96200]"
              >
                Đồng ý
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmSeedMode(null)}
                className="px-2 py-1 text-slate-700 hover:underline font-medium"
              >
                Hủy
              </button>
            </div>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs font-semibold underline ml-4 shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {/* VIEW A: DASHBOARD ANALYTICS */}
      {mode === 'dashboard' && (
        <div className="space-y-6">
          {/* Top KPI Strip on Clean Neutral White Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 tabular-nums">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500">Tổng số hồ sơ</div>
              <div className="text-2xl font-bold text-[#1E293B] mt-1">
                {stats.totalApplications}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Đợt tuyển Mùa Thu 2026</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500">Thời gian xử lý TB (Cycle time)</div>
              <div className="text-2xl font-bold text-[#1E293B] mt-1">
                {stats.metrics.avgCycleTimeHours !== null &&
                stats.metrics.avgCycleTimeHours !== undefined
                  ? `${stats.metrics.avgCycleTimeHours} giờ`
                  : 'Chưa có dữ liệu'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {stats.metrics.avgCycleTimeHours !== null &&
                stats.metrics.avgCycleTimeHours !== undefined
                  ? `Đo thực tế trên ${stats.metrics.finishedCount || 0} hồ sơ đã kết thúc`
                  : 'Chưa có hồ sơ kết thúc quy trình'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500">Hồ sơ cần bổ sung</div>
              <div className="text-2xl font-bold text-[#1E293B] mt-1">
                {stats.metrics.missingInfoRate}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Thiếu thông tin ban đầu</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500">Chưa đạt vòng đơn</div>
              <div className="text-2xl font-bold text-[#1E293B] mt-1">
                {stats.metrics.autoRejectRate}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Vòng xét duyệt hồ sơ</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500">Thư nhắc đặt lịch</div>
              <div className="text-2xl font-bold text-[#1E293B] mt-1">
                {stats.metrics.remindersSentCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Đã gửi lời nhắc</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500">Hồ sơ chờ duyệt</div>
              <div className="text-2xl font-bold text-[#F36F00] mt-1">
                {stats.metrics.hrBacklogTotal + stats.metrics.bcnPendingCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Nhân sự: {stats.metrics.hrBacklogTotal} · BCN: {stats.metrics.bcnPendingCount}
              </div>
            </div>
          </div>

          {/* Results Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1E293B]">
                Thống kê trạng thái hồ sơ ứng viên
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
              {stats.endBreakdown.map((item: any) => (
                <div
                  key={item.key}
                  className="p-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] flex flex-col justify-between"
                >
                  <div className="text-xs font-semibold text-slate-600 leading-snug">
                    {item.label}
                  </div>
                  <div className="text-2xl font-bold text-[#1E293B] mt-2">
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Funnel Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#F36F00]" />
                <span>Tiến độ hồ sơ qua từng vòng tuyển dụng</span>
              </h3>
            </div>
            <div className="space-y-3.5 pt-2">
              {stats.funnel.map((item: { stage: string; count: number }) => {
                const maxCount = Math.max(1, stats.totalApplications || 1);
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={item.stage} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="font-semibold text-[#1E293B]">{item.stage}</span>
                      <span className="font-bold text-slate-700">
                        {item.count} bạn ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all bg-[#F36F00]"
                        style={{
                          width: `${Math.max(4, pct)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: ADMIN CONFIGURATION & AUDIT LOGS */}
      {mode === 'admin' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white border border-[#435B61]/20 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#435B61]/15">
              <div>
                <h2 className="text-base font-bold text-[#26383C] flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#F36F00]" />
                  <span>Cài đặt thông số đợt tuyển & Chỉ tiêu các Ban</span>
                </h2>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                {busy ? 'Đang lưu...' : 'Lưu toàn bộ cấu hình'}
              </button>
            </div>

            {/* Section 1: Thresholds & Timers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="cfg-x" className="block text-xs font-semibold text-[#435B61] mb-1">
                  Điểm chuẩn qua vòng hồ sơ:
                </label>
                <input
                  id="cfg-x"
                  type="number"
                  value={adminData.round.threshold_x}
                  onChange={(e) =>
                    setAdminData({
                      ...adminData,
                      round: { ...adminData.round, threshold_x: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                />
              </div>

              <div>
                <label htmlFor="cfg-y" className="block text-xs font-semibold text-[#435B61] mb-1">
                  Điểm sàn tối thiểu vòng hồ sơ:
                </label>
                <input
                  id="cfg-y"
                  type="number"
                  value={adminData.round.threshold_y}
                  onChange={(e) =>
                    setAdminData({
                      ...adminData,
                      round: { ...adminData.round, threshold_y: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                />
              </div>

              <div>
                <label htmlFor="cfg-margin" className="block text-xs font-semibold text-[#435B61] mb-1">
                  Biên độ điểm xem xét lại:
                </label>
                <input
                  id="cfg-margin"
                  type="number"
                  value={adminData.round.near_threshold_margin}
                  onChange={(e) =>
                    setAdminData({
                      ...adminData,
                      round: { ...adminData.round, near_threshold_margin: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                />
              </div>

              <div>
                <label htmlFor="cfg-min-cards" className="block text-xs font-semibold text-[#435B61] mb-1">
                  Số phiếu chấm tối thiểu / ứng viên:
                </label>
                <input
                  id="cfg-min-cards"
                  type="number"
                  min="1"
                  max="5"
                  value={adminData.round.min_scorecards_per_interview}
                  onChange={(e) =>
                    setAdminData({
                      ...adminData,
                      round: {
                        ...adminData.round,
                        min_scorecards_per_interview: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                />
              </div>

              <div>
                <label htmlFor="cfg-supp-days" className="block text-xs font-semibold text-[#435B61] mb-1">
                  Thời hạn bổ sung hồ sơ (ngày):
                </label>
                <input
                  id="cfg-supp-days"
                  type="number"
                  value={adminData.round.supplement_deadline_days}
                  onChange={(e) =>
                    setAdminData({
                      ...adminData,
                      round: {
                        ...adminData.round,
                        supplement_deadline_days: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                />
              </div>

              <div>
                <label htmlFor="cfg-remind-days" className="block text-xs font-semibold text-[#435B61] mb-1">
                  Thời gian gửi nhắc đặt lịch (ngày):
                </label>
                <input
                  id="cfg-remind-days"
                  type="number"
                  value={adminData.round.remind_after_days}
                  onChange={(e) =>
                    setAdminData({
                      ...adminData,
                      round: { ...adminData.round, remind_after_days: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                />
              </div>

              <div>
                <label htmlFor="cfg-unbook-days" className="block text-xs font-semibold text-[#435B61] mb-1">
                  Thời hạn đặt lịch phỏng vấn (ngày):
                </label>
                <input
                  id="cfg-unbook-days"
                  type="number"
                  value={adminData.round.unbook_after_days}
                  onChange={(e) =>
                    setAdminData({
                      ...adminData,
                      round: { ...adminData.round, unbook_after_days: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                />
              </div>
            </div>

            {/* Hard Conditions Checkboxes */}
            <div className="pt-4 border-t border-[#435B61]/15 space-y-2">
              <div className="text-xs font-bold text-[#26383C]">
                Điều kiện bắt buộc đối với hồ sơ dự tuyển:
              </div>
              <div className="flex flex-wrap items-center gap-6 text-xs text-[#435B61]">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminData.hardConditions.requireActiveStudentId}
                    onChange={(e) =>
                      setAdminData({
                        ...adminData,
                        hardConditions: {
                          ...adminData.hardConditions,
                          requireActiveStudentId: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-[#435B61]/30 text-[#F36F00] focus:ring-[#F36F00]"
                  />
                  Là sinh viên đang học & có MSSV hợp lệ
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminData.hardConditions.requireTimeCommitment}
                    onChange={(e) =>
                      setAdminData({
                        ...adminData,
                        hardConditions: {
                          ...adminData.hardConditions,
                          requireTimeCommitment: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-[#435B61]/30 text-[#F36F00] focus:ring-[#F36F00]"
                  />
                  Cam kết thời gian tham gia sự kiện
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminData.hardConditions.requireValidEmail}
                    onChange={(e) =>
                      setAdminData({
                        ...adminData,
                        hardConditions: {
                          ...adminData.hardConditions,
                          requireValidEmail: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-[#435B61]/30 text-[#F36F00] focus:ring-[#F36F00]"
                  />
                  Có địa chỉ Email hợp lệ
                </label>
              </div>
            </div>

            {/* Department Quotas & Scoring Criteria Weights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-[#435B61]/15">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#1E293B] uppercase">
                  Chỉ tiêu 3 Ban của Câu lạc bộ Thương mại C-RES
                </h3>
                {adminData.departments.map((d, idx) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 bg-[#F8FAFC] p-3 rounded-lg border border-slate-200 text-xs">
                    <span className="font-semibold text-[#1E293B]">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">Chỉ tiêu:</span>
                      <input
                        type="number"
                        min="0"
                        aria-label={`Chỉ tiêu ${d.name}`}
                        value={d.quota}
                        onChange={(e) => {
                          const next = [...adminData.departments];
                          next[idx] = { ...d, quota: Number(e.target.value) };
                          setAdminData({ ...adminData, departments: next });
                        }}
                        className="w-20 px-2.5 py-1 font-bold text-right bg-white border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#26383C] uppercase">
                  5 Tiêu chí chấm điểm Phỏng vấn & Trọng số (%)
                </h3>
                {adminData.criteria.map((c, idx) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 bg-[#F8FAFB] p-2.5 rounded-lg border border-[#435B61]/20 text-xs">
                    <span className="font-semibold text-[#26383C]">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#435B61]">Trọng số (%):</span>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        aria-label={`Trọng số ${c.name}`}
                        value={c.weight}
                        onChange={(e) => {
                          const next = [...adminData.criteria];
                          next[idx] = { ...c, weight: Number(e.target.value) };
                          setAdminData({ ...adminData, criteria: next });
                        }}
                        className="w-20 px-2.5 py-1 font-mono font-bold text-right bg-white border border-[#435B61]/30 rounded"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>

          {/* Pre-Round Deterministic Rule Tester */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-[#F36F00]" />
                  <span>Kiểm thử luật sơ loại trước đợt tuyển</span>
                </h3>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleRunRuleTest}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1E293B] hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              >
                <FlaskConical className="w-3.5 h-3.5 text-[#F36F00]" />
                Chạy kiểm thử luật
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">MSSV (8–14 chữ số):</label>
                <input
                  type="text"
                  value={testForm.student_id}
                  onChange={(e) => setTestForm({ ...testForm, student_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lớp sinh hoạt (VD: 49K01.1):</label>
                <input
                  type="text"
                  value={testForm.class_name}
                  onChange={(e) => setTestForm({ ...testForm, class_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Link CV / Portfolio:</label>
                <input
                  type="text"
                  value={testForm.cv_url}
                  onChange={(e) => setTestForm({ ...testForm, cv_url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Mô tả kinh nghiệm & động lực ứng tuyển:
                </label>
                <textarea
                  rows={2}
                  value={testForm.experience}
                  onChange={(e) => setTestForm({ ...testForm, experience: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={testForm.commitment_confirmed}
                    onChange={(e) =>
                      setTestForm({ ...testForm, commitment_confirmed: e.target.checked })
                    }
                    className="rounded text-[#F36F00]"
                  />
                  Cam kết thời gian tham gia
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={testForm.is_active_student}
                    onChange={(e) =>
                      setTestForm({ ...testForm, is_active_student: e.target.checked })
                    }
                    className="rounded text-[#F36F00]"
                  />
                  Đang là sinh viên chính quy DUE
                </label>
              </div>
            </div>

            {testResult && (() => {
              const evalData = testResult.evaluation ?? {
                totalScore: testResult.score,
                score: testResult.score,
                scoreBreakdown: testResult.scoreBreakdown || {},
                hardConditionsPassed: testResult.hardConditionsPassed,
                violatedConditions: testResult.violatedConditions || [],
                branch: testResult.branch,
                nearThreshold: testResult.nearThreshold,
                explanation:
                  testResult.explanation ||
                  (Array.isArray(testResult.scoreBreakdown)
                    ? testResult.scoreBreakdown.join(' | ')
                    : ''),
              };
              const branchVi =
                evalData.branch === 'clear_pass'
                  ? 'Đạt rõ (clear_pass)'
                  : evalData.branch === 'needs_review'
                    ? 'Cần xem xét (needs_review)'
                    : 'Loại rõ (clear_fail)';

              return (
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-[#1E293B]">
                      Kết quả đầu ra: Tổng điểm sơ loại ={' '}
                      <span className="text-[#F36F00] font-mono text-sm">
                        {evalData.totalScore}/100đ
                      </span>{' '}
                      → Nhánh:{' '}
                      <span className="underline">{branchVi}</span>
                      {evalData.nearThreshold && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px]">
                          Sát ngưỡng Y
                        </span>
                      )}
                    </div>
                    <div className="text-slate-600">{evalData.explanation}</div>
                    {!evalData.hardConditionsPassed && evalData.violatedConditions.length > 0 && (
                      <div className="text-red-700 font-medium">
                        Vi phạm điều kiện cứng: {evalData.violatedConditions.join('; ')}
                      </div>
                    )}
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shrink-0">
                    Deterministic: Đạt chuẩn
                  </span>
                </div>
              );
            })()}
          </div>

          {/* System Activity Log Table */}
          <div className="bg-white border border-[#435B61]/20 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#26383C] flex items-center gap-2">
              <History className="w-5 h-5 text-[#31B5D8]" />
              <span>Nhật ký hoạt động & Truy vết quyết định ({auditLogs.length} bản ghi gần nhất)</span>
            </h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#435B61]/20 bg-[#F8FAFB] text-[11px] font-semibold text-[#435B61] uppercase">
                    <th className="py-2 px-3">Thời điểm</th>
                    <th className="py-2 px-3">Người thực hiện</th>
                    <th className="py-2 px-3">Ứng viên</th>
                    <th className="py-2 px-3">Luật / Hành động</th>
                    <th className="py-2 px-3">Điểm & Lý do chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#435B61]/15">
                  {auditLogs.slice(0, 60).map((log) => (
                    <tr key={log.id} className="hover:bg-[#F8FAFB]">
                      <td className="py-2 px-3 font-mono text-[11px] text-[#435B61] tabular-nums whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold ${
                            log.actor === 'system'
                              ? 'bg-[#31B5D8]/15 text-[#146D85]'
                              : 'bg-[#F36F00]/15 text-[#C45800]'
                          }`}
                        >
                          {log.actor}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-[#26383C]">
                        {log.candidate_name || 'Hệ thống'}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                        <div>{log.action}</div>
                        {log.rule_applied && (
                          <div className="text-[10px] text-[#F36F00]">{log.rule_applied}</div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-[#26383C]">{log.result}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
