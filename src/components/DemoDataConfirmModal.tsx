import React, { useEffect } from 'react';
import {
  AlertTriangle,
  Database,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  X,
  Loader2,
  Users,
  Calendar,
  Settings,
  HelpCircle,
} from 'lucide-react';

export interface DemoDataConfirmModalProps {
  mode: 'empty' | 'sample' | null;
  busy: boolean;
  onConfirm: (mode: 'empty' | 'sample') => void;
  onCancel: () => void;
}

export function DemoDataConfirmModal({
  mode,
  busy,
  onConfirm,
  onCancel,
}: DemoDataConfirmModalProps) {
  // Close on Escape key press when not busy
  useEffect(() => {
    if (!mode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, busy, onCancel]);

  if (!mode) return null;

  const isEmptyMode = mode === 'empty';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`p-5 border-b flex items-start justify-between gap-4 ${
            isEmptyMode ? 'bg-red-50/70 border-red-100' : 'bg-orange-50/70 border-orange-100'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isEmptyMode
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-orange-100 text-[#F36F00] border border-orange-200'
              }`}
            >
              {isEmptyMode ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <Database className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isEmptyMode
                      ? 'bg-red-200/80 text-red-900'
                      : 'bg-orange-200/80 text-orange-900'
                  }`}
                >
                  {isEmptyMode ? 'Thao tác xóa dữ liệu' : 'Thao tác khởi tạo dữ liệu'}
                </span>
                <span className="text-xs text-slate-500 font-medium">Chế độ Demo</span>
              </div>
              <h3
                id="demo-modal-title"
                className="text-base sm:text-lg font-bold text-[#1E293B] mt-1"
              >
                {isEmptyMode
                  ? 'Xác nhận đặt lại đợt tuyển trống (0 hồ sơ)'
                  : 'Xác nhận nạp dữ liệu mẫu (17 ứng viên)'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {isEmptyMode
                  ? 'Làm sạch toàn bộ đơn ứng tuyển và lượt đặt lịch trong đợt để bắt đầu kiểm thử lại từ đầu.'
                  : 'Nạp bộ dữ liệu chuẩn 17 ứng viên (C01–C17) theo kịch bản 6 ngày để phục vụ đánh giá quy trình.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Đóng hộp thoại"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {isEmptyMode ? (
            <>
              {/* Block 1: Dữ liệu thay đổi / bị xóa */}
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-red-900 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Dữ liệu sẽ THAY ĐỔI & XÓA BỎ khỏi hệ thống:</span>
                </div>
                <ul className="space-y-1.5 text-slate-700 pl-5 list-disc marker:text-red-500">
                  <li>
                    <strong className="text-slate-900">Toàn bộ hồ sơ ứng tuyển:</strong> Xóa sạch
                    toàn bộ đơn đăng ký ứng viên trong đợt tuyển hiện tại (về mức 0 hồ sơ).
                  </li>
                  <li>
                    <strong className="text-slate-900">Dữ liệu xử lý quy trình:</strong> Xóa toàn bộ
                    phiếu chấm điểm phỏng vấn của BCN, quyết định trúng tuyển, phân ban, dữ liệu bổ
                    sung thông tin, thông báo và nhật ký thao tác đợt này.
                  </li>
                  <li>
                    <strong className="text-slate-900">Giải phóng ca phỏng vấn:</strong> Hủy toàn bộ
                    lượt đặt chỗ (<code className="px-1 py-0.5 bg-white rounded border border-red-200 text-[11px]">interview_bookings</code>).
                    Toàn bộ ghế đã đặt được trả về trạng thái còn trống 100%.
                  </li>
                  <li>
                    <strong className="text-slate-900">Tài khoản ứng viên thử nghiệm:</strong> Xóa các
                    tài khoản vai trò ứng viên (<code className="px-1 py-0.5 bg-white rounded border border-red-200 text-[11px]">candidate</code>)
                    thuộc đợt này (bảo lưu tài khoản ứng viên mặc định của hệ thống).
                  </li>
                  <li>
                    <strong className="text-slate-900">Mốc thời gian $T_0$:</strong> Đặt lại mốc thời
                    gian giả lập để sẵn sàng khởi tạo mới khi nạp dữ liệu.
                  </li>
                </ul>
              </div>

              {/* Block 2: Cấu hình được giữ nguyên */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cấu hình & Dữ liệu được BẢO LƯU NGUYÊN VẸN:</span>
                </div>
                <ul className="space-y-1.5 text-slate-700 pl-5 list-disc marker:text-emerald-500">
                  <li>
                    <strong className="text-slate-900">Tài khoản nội bộ:</strong> Giữ nguyên tài
                    khoản Quản trị viên (<code className="px-1 py-0.5 bg-white rounded border border-emerald-200 text-[11px]">admin</code>),
                    Ban Nhân sự (<code className="px-1 py-0.5 bg-white rounded border border-emerald-200 text-[11px]">hr</code>) và
                    Ban Chủ nhiệm (<code className="px-1 py-0.5 bg-white rounded border border-emerald-200 text-[11px]">board</code>).
                  </li>
                  <li>
                    <strong className="text-slate-900">Cấu hình đợt tuyển:</strong> Giữ nguyên tên đợt,
                    ngưỡng điểm sơ loại $X, Y$, biên độ $\Delta$, quy tắc phỏng vấn (tối thiểu 2 phiếu chấm),
                    thời hạn các vòng.
                  </li>
                  <li>
                    <strong className="text-slate-900">Chỉ tiêu tuyển dụng:</strong> Giữ nguyên chỉ tiêu
                    gốc đã cấu hình cho 3 Ban (Chuyên môn, Truyền thông, Đối ngoại).
                  </li>
                  <li>
                    <strong className="text-slate-900">Danh mục ca phỏng vấn:</strong> Giữ nguyên danh mục
                    các ca (DEMO_FULL_A, B, C), sức chứa (6 chỗ/ca) và số ghế dự trữ đã cấu hình (chỉ xóa
                    các lượt đặt chỗ, không xóa ca).
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Block 1: Dữ liệu được khởi tạo */}
              <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-orange-950 text-xs">
                  <Users className="w-4 h-4 text-[#F36F00] shrink-0" />
                  <span>Phạm vi tác động & Dữ liệu được khởi tạo:</span>
                </div>
                <ul className="space-y-1.5 text-slate-700 pl-5 list-disc marker:text-[#F36F00]">
                  <li>
                    <strong className="text-slate-900">17 Tài khoản ứng viên mẫu (C01–C17):</strong> Khởi
                    tạo với email <code className="px-1 py-0.5 bg-white rounded border border-orange-200 text-[11px]">candidateXX@cres.due.udn.vn</code> và
                    mật khẩu chung <code className="px-1 py-0.5 bg-white rounded border border-orange-200 text-[11px]">CresDemo2026!</code>.
                  </li>
                  <li>
                    <strong className="text-slate-900">16 Hồ sơ ứng tuyển đa nhánh:</strong> Tự động nộp
                    và đánh giá qua pipeline sơ loại theo các nhánh kịch bản:
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1.5 pt-1 text-[11px]">
                      <span className="p-1.5 bg-white rounded border border-orange-100 text-slate-700">
                        • <strong>C01–C05:</strong> Đạt sơ loại ($\ge X$), chờ đặt lịch
                      </span>
                      <span className="p-1.5 bg-white rounded border border-orange-100 text-slate-700">
                        • <strong>C06–C08:</strong> Cận ngưỡng, BNS cần xem xét
                      </span>
                      <span className="p-1.5 bg-white rounded border border-orange-100 text-slate-700">
                        • <strong>C09–C11:</strong> Không đạt vòng sơ loại
                      </span>
                      <span className="p-1.5 bg-white rounded border border-orange-100 text-slate-700">
                        • <strong>C12:</strong> Hồ sơ thiếu thông tin chờ bổ sung
                      </span>
                      <span className="p-1.5 bg-white rounded border border-orange-100 text-slate-700 sm:col-span-2">
                        • <strong>C14–C17:</strong> Rút trước/sau phân ban, điểm phỏng vấn 0, quá hạn
                      </span>
                    </div>
                  </li>
                  <li>
                    <strong className="text-slate-900">Riêng tài khoản C13:</strong> Được tạo tài khoản
                    nhưng <span className="font-semibold text-[#F36F00]">chưa nộp đơn</span> để người dùng
                    thực hành trải nghiệm ứng viên nộp hồ sơ mới.
                  </li>
                  <li>
                    <strong className="text-slate-900">Bảo vệ chống ghi đè (Idempotent):</strong> Nếu dữ liệu
                    mẫu đã tồn tại, hệ thống bảo lưu nguyên vẹn tiến trình đang thử nghiệm, không tạo trùng
                    lặp tài khoản và không làm xê dịch mốc $T_0$.
                  </li>
                  <li>
                    <strong className="text-slate-900">Đồng bộ ca phỏng vấn:</strong> Khi nạp mới sau khi reset,
                    thời gian các ca DEMO_FULL_A, B, C sẽ được tự động đồng bộ theo mốc hiện tại ($T_0$).
                  </li>
                </ul>
              </div>

              {/* Block 2: Cấu hình được giữ nguyên */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cấu hình & Dữ liệu được BẢO LƯU NGUYÊN VẸN:</span>
                </div>
                <ul className="space-y-1.5 text-slate-700 pl-5 list-disc marker:text-emerald-500">
                  <li>
                    <strong className="text-slate-900">Tài khoản nội bộ:</strong> Giữ nguyên tài khoản
                    và phiên làm việc của Quản trị viên, Ban Nhân sự và Ban Chủ nhiệm.
                  </li>
                  <li>
                    <strong className="text-slate-900">Cấu hình đợt tuyển:</strong> Giữ nguyên tiêu chí,
                    ngưỡng điểm sơ loại, chỉ tiêu 3 Ban và sức chứa các ca phỏng vấn.
                  </li>
                </ul>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Thao tác này chỉ thực thi khi bạn bấm nút xác nhận bên dưới. Bấm nút <strong>Hủy bỏ</strong> sẽ
              đóng hộp thoại này và giữ nguyên toàn bộ dữ liệu hiện tại.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors disabled:opacity-50"
          >
            Hủy bỏ
          </button>

          {isEmptyMode ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm('empty')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang đặt lại đợt tuyển...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xác nhận đặt lại đợt tuyển trống</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm('sample')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors shadow-xs disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang nạp dữ liệu mẫu...</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>Xác nhận nạp dữ liệu mẫu (17 ứng viên)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
