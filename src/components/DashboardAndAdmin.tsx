import React, { useState, useEffect } from 'react';
import {
  FastForward,
  RotateCcw,
  Settings,
  BarChart3,
  Clock,
  Save,
  History,
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
        text: `Đã tua nhanh +${days} ngày (Giờ hệ thống: ${new Date(res.systemNow).toLocaleString(
          'vi-VN'
        )}) → Quét Timer tự động: Loại quá hạn bổ sung (${s.expiredSupplementsCount}), Gửi thư nhắc đặt lịch 1 ngày (${
          s.remindedBookingCount
        }), Gạch tên quá 2 ngày không đặt lịch (${s.droppedNoBookingCount}).`,
      });
      await loadAll();
      onRefreshGlobal();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tua nhanh thời gian',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReseed = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await apiRequest('/admin/seed', { method: 'POST' });
      setBanner({
        type: 'success',
        text: res.message || 'Đã nạp lại dữ liệu mẫu thành công!',
      });
      await loadAll();
      onRefreshGlobal();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi nạp dữ liệu mẫu',
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
        text: 'Đã lưu toàn bộ cấu hình đợt tuyển, ngưỡng X/Y, bộ đếm giờ, chỉ tiêu ban và trọng số chấm điểm.',
      });
      await loadAll();
      onRefreshGlobal();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi lưu cài đặt hệ thống',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !stats || !adminData) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-24 bg-[#435B61]/10 rounded-xl animate-pulse" />
        <div className="h-80 bg-[#435B61]/10 rounded-xl animate-pulse" />
      </div>
    );
  }

  const funnelBarColors = [
    '#F36F00', // C-res Orange
    '#31B5D8', // C-res Cyan
    '#FDD000', // C-res Yellow
    '#F36F00', // C-res Orange
    '#31B5D8', // C-res Cyan
    '#68A225', // C-res Green
  ];

  return (
    <div className="space-y-6">
      {/* Time-Travel & Brand Control Bar */}
      <div className="bg-white border border-[#435B61]/20 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <img
            src={CRES_LOGO_PATH}
            alt="Logo CLB C-res"
            className="h-11 w-auto object-contain hidden sm:block shrink-0"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#F36F00] tabular-nums">
              <Clock className="w-4 h-4 text-[#F36F00]" />
              <span>
                ĐỒNG HỒ HỆ THỐNG: {new Date(adminData.systemNow).toLocaleString('vi-VN')} · TIME_SCALE ={' '}
                {adminData.timeScale}x
              </span>
            </div>
            <p className="text-xs text-[#435B61]">
              Sử dụng nút Tua nhanh thời gian (+1 ngày / +2 ngày) để kiểm thử ngay lập tức các bộ đếm giờ: hạn bổ sung 2 ngày, nhắc đặt lịch 1 ngày và tự động gạch tên sau 2 ngày.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleTimeTravel(1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#31B5D8] hover:bg-[#239CBC] rounded-lg transition-colors whitespace-nowrap"
          >
            <FastForward className="w-3.5 h-3.5" />
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
          <button
            type="button"
            disabled={busy}
            onClick={handleReseed}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#26383C] bg-white hover:bg-[#F4F7F8] border border-[#435B61]/30 rounded-lg transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#68A225]" />
            Nạp dữ liệu mẫu (42 hồ sơ)
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-[#68A225]/10 border-[#68A225]/40 text-[#3B5E12]'
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
          {/* Top KPI Strip accented with C-res Logo Colors on White */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 tabular-nums">
            <div className="bg-white border border-[#435B61]/20 border-t-4 border-t-[#F36F00] rounded-xl p-4">
              <div className="text-xs font-medium text-[#435B61]">Tổng số hồ sơ (Cases)</div>
              <div className="text-2xl font-bold font-mono text-[#26383C] mt-1">
                {stats.totalApplications}
              </div>
              <div className="text-[11px] text-[#435B61] mt-0.5">Đợt tuyển Mùa Thu 2026</div>
            </div>

            <div className="bg-white border border-[#435B61]/20 border-t-4 border-t-[#68A225] rounded-xl p-4">
              <div className="text-xs font-medium text-[#435B61]">Cycle Time trung bình</div>
              <div className="text-2xl font-bold font-mono text-[#53821D] mt-1">
                {stats.metrics.avgCycleTimeDays} ngày
              </div>
              <div className="text-[11px] text-[#53821D] font-semibold mt-0.5">
                ({stats.metrics.avgCycleTimeHours} giờ vs 12 ngày AS-IS)
              </div>
            </div>

            <div className="bg-white border border-[#435B61]/20 border-t-4 border-t-[#FDD000] rounded-xl p-4">
              <div className="text-xs font-medium text-[#435B61]">Tỷ lệ hồ sơ thiếu TT</div>
              <div className="text-2xl font-bold font-mono text-[#9E7D00] mt-1">
                {stats.metrics.missingInfoRate}%
              </div>
              <div className="text-[11px] text-[#435B61] mt-0.5">Tự động yêu cầu bổ sung</div>
            </div>

            <div className="bg-white border border-[#435B61]/20 border-t-4 border-t-[#435B61] rounded-xl p-4">
              <div className="text-xs font-medium text-[#435B61]">Tỷ lệ tự động loại</div>
              <div className="text-2xl font-bold font-mono text-[#435B61] mt-1">
                {stats.metrics.autoRejectRate}%
              </div>
              <div className="text-[11px] text-[#435B61] mt-0.5">Có ghi Audit Log đầy đủ</div>
            </div>

            <div className="bg-white border border-[#435B61]/20 border-t-4 border-t-[#31B5D8] rounded-xl p-4">
              <div className="text-xs font-medium text-[#435B61]">Số lượt nhắc tự động</div>
              <div className="text-2xl font-bold font-mono text-[#188BA8] mt-1">
                {stats.metrics.remindersSentCount}
              </div>
              <div className="text-[11px] text-[#435B61] mt-0.5">Nhắc đặt lịch sau 1 ngày</div>
            </div>

            <div className="bg-white border border-[#435B61]/20 border-t-4 border-t-[#F36F00] rounded-xl p-4">
              <div className="text-xs font-medium text-[#435B61]">Tồn đọng chờ người xử lý</div>
              <div className="text-2xl font-bold font-mono text-[#F36F00] mt-1">
                {stats.metrics.hrBacklogTotal + stats.metrics.bcnPendingCount}
              </div>
              <div className="text-[11px] text-[#435B61] mt-0.5">
                HR: {stats.metrics.hrBacklogTotal} · BCN: {stats.metrics.bcnPendingCount}
              </div>
            </div>
          </div>

          {/* 6 End Points Breakdown */}
          <div className="bg-white border border-[#435B61]/20 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#26383C]">
                Thống kê 6 Điểm Kết Thúc Quy Trình (Process End Events)
              </h2>
              <p className="text-xs text-[#435B61]">
                Theo dõi toàn bộ các trường hợp kết thúc luồng TO-BE: Bị loại vì quá hạn · Hồ sơ không đạt · Ứng viên không tham gia · Ứng viên không đạt · Đã rút đơn · Hoàn tất quy trình tuyển CTV.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
              {stats.endBreakdown.map((item: any) => (
                <div
                  key={item.key}
                  className="p-3.5 rounded-xl border border-[#435B61]/20 bg-white flex flex-col justify-between"
                >
                  <div className="text-xs font-semibold text-[#435B61] leading-snug">
                    {item.label}
                  </div>
                  <div
                    className="text-2xl font-bold font-mono mt-2"
                    style={{ color: item.color }}
                  >
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Funnel Chart & Stage Wait Times */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-[#435B61]/20 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#26383C] flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#F36F00]" />
                  <span>Phễu chuyển đổi ứng viên theo từng bước (Conversion Funnel)</span>
                </h3>
                <p className="text-xs text-[#435B61]">
                  Số lượng ứng viên đi qua từng cổng kiểm tra của quy trình TO-BE (Màu sắc theo 4 chữ C-r-e-s)
                </p>
              </div>
              <div className="space-y-3 pt-2">
                {stats.funnel.map((item: { stage: string; count: number }, idx: number) => {
                  const maxCount = Math.max(1, stats.totalApplications || 1);
                  const pct = Math.round((item.count / maxCount) * 100);
                  const barColor = funnelBarColors[idx % funnelBarColors.length];
                  return (
                    <div key={item.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="font-semibold text-[#26383C]">{item.stage}</span>
                        <span className="font-mono font-bold text-[#26383C]">
                          {item.count} ứng viên ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-[#F4F7F8] rounded-full overflow-hidden border border-[#435B61]/15">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(4, pct)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-[#435B61]/20 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#26383C]">
                  So sánh tham chiếu: Quy trình cũ (AS-IS) vs Hệ thống mới (TO-BE)
                </h3>
                <p className="text-xs text-[#435B61]">
                  Đối chiếu hiệu quả số hóa và tự động hóa tại CLB C-res
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-[#435B61]/20 bg-[#F8FAFB] text-[#435B61] font-semibold">
                      <th className="py-2 px-2.5">Chỉ số đo lường</th>
                      <th className="py-2 px-2.5">AS-IS (Thủ công)</th>
                      <th className="py-2 px-2.5 text-[#F36F00]">TO-BE (Thực tế)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#435B61]/15">
                    <tr>
                      <td className="py-2.5 px-2.5 font-medium text-[#26383C]">Tổng thời gian chu trình (Cycle Time)</td>
                      <td className="py-2.5 px-2.5 font-mono text-[#435B61]">≈ 12 ngày</td>
                      <td className="py-2.5 px-2.5 font-mono font-bold text-[#53821D]">
                        {stats.metrics.avgCycleTimeDays} ngày ({stats.metrics.avgCycleTimeHours}h)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-2.5 font-medium text-[#26383C]">Số lần bàn giao (Handoffs)</td>
                      <td className="py-2.5 px-2.5 font-mono text-[#435B61]">11 lần rời rạc</td>
                      <td className="py-2.5 px-2.5 font-mono font-bold text-[#188BA8]">4 điểm chốt chính</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-2.5 font-medium text-[#26383C]">Kiểm tra & Sơ loại hồ sơ</td>
                      <td className="py-2.5 px-2.5 text-[#435B61]">Dò Excel thủ công (2 ngày)</td>
                      <td className="py-2.5 px-2.5 text-[#53821D] font-semibold">Tức thì theo luật X/Y (&lt;1 giây)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-2.5 font-medium text-[#26383C]">Đặt lịch phỏng vấn</td>
                      <td className="py-2.5 px-2.5 text-[#435B61]">Nhắn tin xếp lịch từng người</td>
                      <td className="py-2.5 px-2.5 text-[#53821D] font-semibold">Ứng viên tự chọn + Timer 1d/2d</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-2.5 font-medium text-[#26383C]">Phỏng vấn & Chấm điểm</td>
                      <td className="py-2.5 px-2.5 text-[#435B61]">Chờ hết cả đợt mới tổng hợp</td>
                      <td className="py-2.5 px-2.5 text-[#53821D] font-semibold">Song song (AND-join từng người)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-2.5 font-medium text-[#26383C]">Phân công vị trí / ban</td>
                      <td className="py-2.5 px-2.5 text-[#435B61]">Chia tay thủ công trên Excel</td>
                      <td className="py-2.5 px-2.5 text-[#53821D] font-semibold">Gemini AI gợi ý + HR duyệt chốt</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
                  <span>Cấu hình Luật Sơ loại (X, Y), Bộ đếm giờ (Timers), Chỉ tiêu Ban & Trọng số</span>
                </h2>
                <p className="text-xs text-[#435B61]">
                  Mọi thay đổi ngưỡng X, Y, biên độ gần ngưỡng và thời hạn được áp dụng ngay cho Rules Engine mà không cần sửa code.
                </p>
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
                  Ngưỡng Đạt rõ X (Điểm ≥ X):
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
                  Ngưỡng Loại rõ Y (Điểm &lt; Y):
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
                  Biên độ gần ngưỡng Y (mặc định 5đ):
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
                  Số phiếu điểm tối thiểu (AND-join):
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
                  Timer hạn bổ sung hồ sơ (ngày):
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
                  Timer nhắc đặt lịch PV (ngày):
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
                  Timer gạch tên không đặt lịch (ngày):
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

              <div>
                <label htmlFor="cfg-timescale" className="block text-xs font-semibold text-[#435B61] mb-1">
                  TIME_SCALE (1 = Thực tế, 720 = 1 ngày/2 phút):
                </label>
                <input
                  id="cfg-timescale"
                  type="number"
                  min="1"
                  value={adminData.timeScale}
                  onChange={(e) =>
                    setAdminData({ ...adminData, timeScale: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                />
              </div>
            </div>

            {/* Hard Conditions Checkboxes */}
            <div className="pt-4 border-t border-[#435B61]/15 space-y-2">
              <div className="text-xs font-bold text-[#26383C]">
                Danh sách Điều kiện cứng ở bước Sơ loại (Vi phạm → Loại rõ):
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
                <h3 className="text-xs font-bold text-[#26383C] uppercase">
                  Chỉ tiêu 4 Ban của CLB C-res
                </h3>
                {adminData.departments.map((d, idx) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 bg-[#F8FAFB] p-2.5 rounded-lg border border-[#435B61]/20 text-xs">
                    <span className="font-semibold text-[#26383C]">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#435B61]">Chỉ tiêu:</span>
                      <input
                        type="number"
                        min="1"
                        aria-label={`Chỉ tiêu ${d.name}`}
                        value={d.quota}
                        onChange={(e) => {
                          const next = [...adminData.departments];
                          next[idx] = { ...d, quota: Number(e.target.value) };
                          setAdminData({ ...adminData, departments: next });
                        }}
                        className="w-20 px-2.5 py-1 font-mono font-bold text-right bg-white border border-[#435B61]/30 rounded"
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

          {/* System Audit Log Table */}
          <div className="bg-white border border-[#435B61]/20 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#26383C] flex items-center gap-2">
              <History className="w-5 h-5 text-[#31B5D8]" />
              <span>Nhật ký Kiểm toán Hệ thống (System Audit Logs — {auditLogs.length} bản ghi gần nhất)</span>
            </h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#435B61]/20 bg-[#F8FAFB] text-[11px] font-semibold text-[#435B61] uppercase">
                    <th className="py-2 px-3">Thời điểm</th>
                    <th className="py-2 px-3">Tác nhân</th>
                    <th className="py-2 px-3">Sự kiện / Hành động</th>
                    <th className="py-2 px-3">Ứng viên</th>
                    <th className="py-2 px-3">Luật & Kết quả</th>
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
                      <td className="py-2 px-3 font-mono font-semibold text-[#26383C]">
                        {log.action}
                      </td>
                      <td className="py-2 px-3 font-medium text-[#26383C]">
                        {log.candidate_name || 'Hệ thống'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-[#26383C]">{log.result}</div>
                        <div className="text-[11px] font-mono text-[#435B61]">
                          Rule: {log.rule_applied}
                        </div>
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
