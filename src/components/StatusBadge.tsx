import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  UserCheck,
} from 'lucide-react';
import type { ApplicationStatus, EndReason, UserRole } from '../types';
import { STATUS_LABELS, END_REASON_LABELS } from '../types';

export type StatusSemanticKind =
  | 'action_required'
  | 'waiting'
  | 'scheduled'
  | 'success'
  | 'rejected'
  | 'withdrawn';

export interface StatusExplanationMeta {
  status: ApplicationStatus;
  label: string;
  stage: string;
  whereItIs: string;
  nextActor: 'Ứng viên' | 'Ban Nhân sự' | 'Ban Chủ nhiệm' | 'Hệ thống' | 'Đã kết thúc';
  nextAction: string;
  kind: StatusSemanticKind;
}

const INTERNAL_STATUS_META: Record<ApplicationStatus, Omit<StatusExplanationMeta, 'status'>> = {
  submitted: {
    label: STATUS_LABELS.submitted,
    stage: 'Bước 1 · Tiếp nhận hồ sơ',
    whereItIs: 'Hồ sơ vừa được ứng viên gửi lên hệ thống',
    nextActor: 'Hệ thống',
    nextAction: 'Tự động kiểm tra các trường bắt buộc và chấm điểm sơ loại',
    kind: 'waiting',
  },
  checking: {
    label: STATUS_LABELS.checking,
    stage: 'Bước 1 · Kiểm tra thông tin',
    whereItIs: 'Hệ thống đang kiểm tra tính đầy đủ của thông tin hồ sơ',
    nextActor: 'Hệ thống',
    nextAction: 'Chuyển sang yêu cầu bổ sung nếu thiếu hoặc chấm sơ loại nếu đủ',
    kind: 'waiting',
  },
  needs_supplement: {
    label: STATUS_LABELS.needs_supplement,
    stage: 'Bước 1 · Cần bổ sung thông tin',
    whereItIs: 'Hồ sơ còn thiếu trường bắt buộc và đang chờ bổ sung trong thời hạn',
    nextActor: 'Ứng viên',
    nextAction: 'Điền và gửi thông tin bổ sung trước thời hạn (tối đa 2 lần trong 2 ngày)',
    kind: 'action_required',
  },
  supplement_submitted: {
    label: STATUS_LABELS.supplement_submitted,
    stage: 'Bước 1 · Đã nộp bổ sung',
    whereItIs: 'Ứng viên đã gửi thông tin bổ sung cho hồ sơ',
    nextActor: 'Hệ thống',
    nextAction: 'Tự động kiểm tra lại thông tin và chấm điểm sơ loại vòng đơn',
    kind: 'waiting',
  },
  expired_supplement: {
    label: STATUS_LABELS.expired_supplement,
    stage: 'Kết thúc ở Vòng hồ sơ',
    whereItIs: 'Quá hạn 2 ngày chờ bổ sung hoặc vượt quá 2 lần bổ sung nhưng vẫn thiếu thông tin',
    nextActor: 'Đã kết thúc',
    nextAction: 'Quy trình tuyển dụng của hồ sơ này đã dừng lại',
    kind: 'rejected',
  },
  screening: {
    label: STATUS_LABELS.screening,
    stage: 'Bước 2 · Sơ loại tự động',
    whereItIs: 'Hệ thống đang tính điểm sơ loại và đối chiếu ngưỡng X, Y',
    nextActor: 'Hệ thống',
    nextAction: 'Phân nhánh tự động Đạt rõ, Cần xem xét hoặc Loại rõ',
    kind: 'waiting',
  },
  clear_pass: {
    label: STATUS_LABELS.clear_pass,
    stage: 'Bước 2 · Đạt rõ vòng hồ sơ',
    whereItIs: 'Điểm sơ loại đạt từ ngưỡng chuẩn X trở lên và thỏa điều kiện bắt buộc',
    nextActor: 'Ứng viên',
    nextAction: 'Chọn khung giờ phỏng vấn còn chỗ trống trong thời hạn 2 ngày',
    kind: 'success',
  },
  needs_review: {
    label: STATUS_LABELS.needs_review,
    stage: 'Bước 2 · Chờ xem xét vòng hồ sơ',
    whereItIs: 'Điểm sơ loại nằm trong khoảng xem xét [Y, X) cần đọc kỹ nội dung đơn',
    nextActor: 'Ban Nhân sự',
    nextAction: 'Nhập nhận xét và duyệt Đạt (mời phỏng vấn) hoặc Không đạt tại tab Duyệt hồ sơ',
    kind: 'action_required',
  },
  clear_fail: {
    label: STATUS_LABELS.clear_fail,
    stage: 'Bước 2 · Chờ xem xét sát ngưỡng Y',
    whereItIs: 'Điểm sơ loại dưới ngưỡng sàn Y nhưng nằm trong biên độ sát ngưỡng được giữ lại',
    nextActor: 'Ban Nhân sự',
    nextAction: 'Xem lại tại tab Hồ sơ cần được xem xét để Chốt Loại hoặc Cứu xét sang Đạt',
    kind: 'action_required',
  },
  review_pass: {
    label: STATUS_LABELS.review_pass,
    stage: 'Bước 2 · Đạt vòng hồ sơ',
    whereItIs: 'Ban Nhân sự đã duyệt Đạt vòng hồ sơ và mở quyền chọn lịch phỏng vấn',
    nextActor: 'Ứng viên',
    nextAction: 'Chọn khung giờ phỏng vấn phù hợp trước thời hạn 2 ngày',
    kind: 'success',
  },
  review_fail: {
    label: STATUS_LABELS.review_fail,
    stage: 'Kết thúc ở Vòng hồ sơ',
    whereItIs: 'Hồ sơ không đạt qua bước xét duyệt của Ban Nhân sự',
    nextActor: 'Đã kết thúc',
    nextAction: 'Đã gửi thư cảm ơn và khép lại hồ sơ ở vòng đơn',
    kind: 'rejected',
  },
  rejected_docs: {
    label: STATUS_LABELS.rejected_docs,
    stage: 'Kết thúc ở Vòng hồ sơ',
    whereItIs: 'Hồ sơ chưa đáp ứng tiêu chí vòng đơn (tự động loại hoặc Ban Nhân sự chốt loại)',
    nextActor: 'Đã kết thúc',
    nextAction: 'Đã gửi thông báo kết quả vòng hồ sơ, không còn thao tác tiếp theo',
    kind: 'rejected',
  },
  invited_to_book: {
    label: STATUS_LABELS.invited_to_book,
    stage: 'Bước 3 · Chờ đặt lịch phỏng vấn',
    whereItIs: 'Đã vượt qua vòng hồ sơ và được gửi thư mời chọn ca phỏng vấn',
    nextActor: 'Ứng viên',
    nextAction: 'Chọn 1 ca phỏng vấn còn chỗ trống trong vòng 2 ngày kể từ khi nhận lời mời',
    kind: 'action_required',
  },
  booked: {
    label: STATUS_LABELS.booked,
    stage: 'Bước 4 · Chờ phỏng vấn',
    whereItIs: 'Ứng viên đã giữ chỗ thành công tại một ca phỏng vấn',
    nextActor: 'Ứng viên',
    nextAction: 'Đến phỏng vấn đúng giờ và bấm Điểm danh (hoặc BCN chấm điểm & Check-in)',
    kind: 'scheduled',
  },
  no_booking: {
    label: STATUS_LABELS.no_booking,
    stage: 'Kết thúc ở Vòng đặt lịch',
    whereItIs: 'Quá hạn 2 ngày kể từ khi mở chọn lịch nhưng ứng viên chưa đặt ca phỏng vấn',
    nextActor: 'Đã kết thúc',
    nextAction: 'Hệ thống đã tự động gạch tên vì không tham gia phỏng vấn',
    kind: 'rejected',
  },
  interviewing: {
    label: STATUS_LABELS.interviewing,
    stage: 'Bước 4 · Đang phỏng vấn (Song song)',
    whereItIs: 'Đã thực hiện một phần (đã Check-in hoặc đã có phiếu chấm đầu tiên)',
    nextActor: 'Ban Chủ nhiệm',
    nextAction: 'Hoàn tất Check-in và nộp đủ số phiếu chấm tối thiểu để hội tụ kết quả',
    kind: 'waiting',
  },
  scored: {
    label: STATUS_LABELS.scored,
    stage: 'Bước 5 · Chờ quyết định Đậu/Rớt',
    whereItIs: 'Đã hội tụ đủ Check-in có mặt và đủ số phiếu chấm điểm phỏng vấn tối thiểu',
    nextActor: 'Ban Chủ nhiệm',
    nextAction: 'Chọn quyết định Chọn Đậu hoặc Chọn Rớt cho ứng viên',
    kind: 'action_required',
  },
  decided_pass: {
    label: STATUS_LABELS.decided_pass,
    stage: 'Bước 5 · Chờ chốt gửi thông báo Đậu',
    whereItIs: 'Ban Chủ nhiệm đã chọn Đậu tạm thời nhưng chưa phát hành thông báo chính thức',
    nextActor: 'Ban Chủ nhiệm',
    nextAction: 'Bấm Chốt và gửi thông báo để gửi thư trúng tuyển cho ứng viên',
    kind: 'action_required',
  },
  decided_fail: {
    label: STATUS_LABELS.decided_fail,
    stage: 'Bước 5 · Chờ chốt gửi thông báo Rớt',
    whereItIs: 'Ban Chủ nhiệm đã chọn Rớt tạm thời nhưng chưa phát hành thông báo chính thức',
    nextActor: 'Ban Chủ nhiệm',
    nextAction: 'Bấm Chốt và gửi thông báo để gửi thư cảm ơn và khép lại hồ sơ',
    kind: 'action_required',
  },
  failed_interview: {
    label: STATUS_LABELS.failed_interview,
    stage: 'Kết thúc ở Vòng phỏng vấn',
    whereItIs: 'Ứng viên không đạt ở vòng phỏng vấn sau khi Ban Chủ nhiệm chốt kết quả',
    nextActor: 'Đã kết thúc',
    nextAction: 'Đã gửi thông báo kết quả phỏng vấn, quy trình kết thúc',
    kind: 'rejected',
  },
  offer_sent: {
    label: STATUS_LABELS.offer_sent,
    stage: 'Bước 5 · Chờ xác nhận tham gia',
    whereItIs: 'Đã trúng tuyển phỏng vấn và nhận thông báo mời gia nhập CLB',
    nextActor: 'Ứng viên',
    nextAction: 'Bấm nút Xác nhận tham gia C-RES để vào nhóm CLB và chờ phân ban',
    kind: 'action_required',
  },
  confirmed_joined: {
    label: STATUS_LABELS.confirmed_joined,
    stage: 'Bước 6 · Chờ phân ban',
    whereItIs: 'Ứng viên đã xác nhận tham gia và vào nhóm sinh hoạt chung của CLB',
    nextActor: 'Ban Nhân sự',
    nextAction: 'Xem gợi ý phân ban (AI/luật) và bấm Chốt phân công và gửi tại tab Phân công 3 Ban',
    kind: 'action_required',
  },
  assigned: {
    label: STATUS_LABELS.assigned,
    stage: 'Bước 6 · Đang chốt phân công Ban',
    whereItIs: 'Đã được chọn ban dự kiến trong danh sách phân công',
    nextActor: 'Ban Nhân sự',
    nextAction: 'Xác nhận chốt phân công để hoàn tất quy trình tuyển CTV',
    kind: 'waiting',
  },
  completed: {
    label: STATUS_LABELS.completed,
    stage: 'Bước 6 · Hoàn tất quy trình',
    whereItIs: 'Đã chính thức trở thành Cộng tác viên và được phân công về Ban chuyên môn',
    nextActor: 'Đã kết thúc',
    nextAction: 'Hoàn tất toàn bộ quy trình tuyển dụng CTV C-RES',
    kind: 'success',
  },
  withdrawn: {
    label: STATUS_LABELS.withdrawn,
    stage: 'Đã dừng theo yêu cầu rút đơn',
    whereItIs: 'Ứng viên đã chủ động gửi yêu cầu rút hồ sơ khỏi đợt tuyển',
    nextActor: 'Đã kết thúc',
    nextAction: 'Hồ sơ đã đóng (đã tự động trả lại ghế phỏng vấn hoặc chỉ tiêu ban nếu có)',
    kind: 'withdrawn',
  },
};

/**
 * Returns role-appropriate status metadata.
 * When viewerRole === 'candidate', internal deliberation states (such as clear_fail, needs_review,
 * decided_pass, decided_fail) are presented with candidate-appropriate wording without leaking
 * internal scoring or pre-notification decisions.
 */
export function getStatusMeta(
  status: ApplicationStatus,
  viewerRole: UserRole = 'hr'
): StatusExplanationMeta {
  const base = INTERNAL_STATUS_META[status] || {
    label: STATUS_LABELS[status] || status,
    stage: 'Trạng thái hồ sơ',
    whereItIs: 'Đang cập nhật trạng thái hồ sơ',
    nextActor: 'Hệ thống' as const,
    nextAction: 'Theo dõi thông báo tiếp theo',
    kind: 'waiting' as const,
  };

  if (viewerRole !== 'candidate') {
    return { status, ...base };
  }

  // Role-restricted overrides for Candidate view:
  switch (status) {
    case 'submitted':
    case 'checking':
    case 'supplement_submitted':
    case 'screening':
    case 'needs_review':
    case 'clear_fail':
      return {
        status,
        label: 'Chờ xem xét hồ sơ',
        stage: 'Bước 2 · Vòng xét duyệt hồ sơ',
        whereItIs: 'Hồ sơ của bạn đang được Ban Nhân sự C-RES xem xét ở vòng đơn',
        nextActor: 'Ban Nhân sự',
        nextAction: 'Ban Nhân sự thẩm định hồ sơ và gửi thông báo kết quả vòng đơn cho bạn',
        kind: 'waiting',
      };
    case 'needs_supplement':
      return {
        status,
        label: 'Cần bổ sung hồ sơ',
        stage: 'Bước 1 · Cần bổ sung thông tin',
        whereItIs: 'Hồ sơ của bạn còn thiếu thông tin bắt buộc',
        nextActor: 'Ứng viên',
        nextAction: 'Bạn cần điền và bấm Gửi thông tin bổ sung trước khi hết hạn',
        kind: 'action_required',
      };
    case 'clear_pass':
    case 'review_pass':
    case 'invited_to_book':
      return {
        status,
        label: 'Chờ đặt lịch phỏng vấn',
        stage: 'Bước 3 · Đặt lịch phỏng vấn',
        whereItIs: 'Bạn đã vượt qua vòng hồ sơ và được mời chọn khung giờ phỏng vấn',
        nextActor: 'Ứng viên',
        nextAction: 'Bạn cần chọn 1 khung giờ phỏng vấn còn chỗ trống trước thời hạn 2 ngày',
        kind: 'action_required',
      };
    case 'booked':
      return {
        status,
        label: 'Chờ phỏng vấn (Đã đặt lịch)',
        stage: 'Bước 4 · Tham gia phỏng vấn',
        whereItIs: 'Bạn đã đặt lịch phỏng vấn thành công',
        nextActor: 'Ứng viên',
        nextAction: 'Bạn đến đúng giờ hẹn và bấm Điểm danh tham gia phỏng vấn',
        kind: 'scheduled',
      };
    case 'interviewing':
    case 'scored':
    case 'decided_pass':
    case 'decided_fail':
      return {
        status,
        label: 'Chờ kết quả phỏng vấn',
        stage: 'Bước 4–5 · Tổng hợp kết quả phỏng vấn',
        whereItIs: 'Buổi phỏng vấn của bạn đang được Ban Chủ nhiệm tổng hợp điểm và xét kết quả',
        nextActor: 'Ban Chủ nhiệm',
        nextAction: 'Ban Chủ nhiệm chốt kết quả và gửi thông báo chính thức đến Hộp thư của bạn',
        kind: 'waiting',
      };
    case 'offer_sent':
      return {
        status,
        label: 'Chờ xác nhận tham gia',
        stage: 'Bước 5 · Xác nhận gia nhập CLB',
        whereItIs: 'Chúc mừng bạn đã trúng tuyển vòng phỏng vấn C-RES',
        nextActor: 'Ứng viên',
        nextAction: 'Bạn cần bấm nút Xác nhận tham gia C-RES để vào nhóm sinh hoạt chung',
        kind: 'action_required',
      };
    case 'confirmed_joined':
    case 'assigned':
      return {
        status,
        label: 'Chờ phân ban',
        stage: 'Bước 6 · Phân công Ban chuyên môn',
        whereItIs: 'Bạn đã xác nhận tham gia CLB và đang trong danh sách xếp Ban',
        nextActor: 'Ban Nhân sự',
        nextAction: 'Ban Nhân sự chốt phân công Ban chính thức và gửi thông báo cho bạn',
        kind: 'waiting',
      };
    case 'completed':
      return {
        status,
        label: 'Hoàn tất tuyển CTV',
        stage: 'Bước 6 · Hoàn tất quy trình',
        whereItIs: 'Bạn đã chính thức trở thành Cộng tác viên và được phân công về Ban',
        nextActor: 'Đã kết thúc',
        nextAction: 'Quy trình ứng tuyển đã hoàn tất thành công',
        kind: 'success',
      };
    case 'rejected_docs':
    case 'review_fail':
      return {
        status,
        label: 'Không đạt vòng hồ sơ',
        stage: 'Kết thúc ở Vòng hồ sơ',
        whereItIs: 'Hồ sơ chưa đáp ứng đủ tiêu chí vòng đơn của đợt tuyển này',
        nextActor: 'Đã kết thúc',
        nextAction: 'Hồ sơ đã khép lại, hẹn gặp bạn ở các đợt tuyển tiếp theo',
        kind: 'rejected',
      };
    case 'expired_supplement':
      return {
        status,
        label: 'Không đạt (Quá hạn bổ sung)',
        stage: 'Kết thúc ở Vòng bổ sung hồ sơ',
        whereItIs: 'Hồ sơ đã quá thời hạn 2 ngày hoặc vượt quá 2 lần bổ sung thông tin',
        nextActor: 'Đã kết thúc',
        nextAction: 'Hồ sơ đã khép lại do chưa hoàn tất bổ sung đúng hạn',
        kind: 'rejected',
      };
    case 'no_booking':
      return {
        status,
        label: 'Không tham gia (Quá hạn đặt lịch)',
        stage: 'Kết thúc ở Vòng đặt lịch phỏng vấn',
        whereItIs: 'Đã qua thời hạn 2 ngày nhưng bạn chưa chọn khung giờ phỏng vấn',
        nextActor: 'Đã kết thúc',
        nextAction: 'Hồ sơ đã khép lại do quá hạn đặt lịch phỏng vấn',
        kind: 'rejected',
      };
    case 'failed_interview':
      return {
        status,
        label: 'Không đạt vòng phỏng vấn',
        stage: 'Kết thúc ở Vòng phỏng vấn',
        whereItIs: 'Hồ sơ chưa phù hợp với chỉ tiêu tuyển chọn sau vòng phỏng vấn',
        nextActor: 'Đã kết thúc',
        nextAction: 'Hồ sơ đã khép lại sau vòng phỏng vấn',
        kind: 'rejected',
      };
    case 'withdrawn':
      return {
        status,
        label: 'Đã rút đơn',
        stage: 'Đã dừng theo yêu cầu',
        whereItIs: 'Bạn đã chủ động rút hồ sơ ứng tuyển khỏi đợt tuyển này',
        nextActor: 'Đã kết thúc',
        nextAction: 'Hồ sơ đã dừng theo yêu cầu của bạn',
        kind: 'withdrawn',
      };
    default:
      return { status, ...base };
  }
}

function StatusKindIcon({ kind, className = 'w-3.5 h-3.5 shrink-0' }: { kind: StatusSemanticKind; className?: string }) {
  switch (kind) {
    case 'action_required':
      return <AlertTriangle className={className} aria-hidden="true" />;
    case 'scheduled':
      return <Calendar className={className} aria-hidden="true" />;
    case 'success':
      return <CheckCircle2 className={className} aria-hidden="true" />;
    case 'rejected':
      return <XCircle className={className} aria-hidden="true" />;
    case 'withdrawn':
      return <MinusCircle className={className} aria-hidden="true" />;
    case 'waiting':
    default:
      return <Clock className={className} aria-hidden="true" />;
  }
}

export function StatusBadge({
  status,
  viewerRole = 'hr',
  showDescription = false,
}: {
  status: ApplicationStatus;
  viewerRole?: UserRole;
  showDescription?: boolean;
}) {
  const meta = getStatusMeta(status, viewerRole);

  const colorMap: Record<StatusSemanticKind, string> = {
    action_required: 'bg-orange-50 text-[#C45800] border-orange-200',
    waiting: 'bg-sky-50 text-sky-800 border-sky-200',
    scheduled: 'bg-blue-50 text-blue-800 border-blue-200',
    success:
      status === 'completed'
        ? 'bg-emerald-600 text-white border-emerald-600'
        : 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    withdrawn: 'bg-slate-100 text-slate-700 border-slate-300',
  };

  const nextActorLabel =
    viewerRole === 'candidate' && meta.nextActor === 'Ứng viên'
      ? 'Bạn cần thực hiện'
      : meta.nextActor === 'Đã kết thúc'
      ? 'Đã kết thúc'
      : `Tiếp theo: ${meta.nextActor}`;

  const tooltipText = `${meta.label} (${meta.stage}) — Đang ở đâu: ${meta.whereItIs}. ${nextActorLabel}: ${meta.nextAction}`;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        title={tooltipText}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md border whitespace-nowrap shrink-0 cursor-help ${
          colorMap[meta.kind]
        }`}
      >
        <StatusKindIcon kind={meta.kind} className="w-3.5 h-3.5 shrink-0" />
        <span>{meta.label}</span>
      </span>
      {showDescription && (
        <span className="text-[11px] text-slate-600 leading-snug max-w-xs">
          <strong className="text-slate-800">{nextActorLabel}:</strong> {meta.nextAction}
        </span>
      )}
    </div>
  );
}

export function EndReasonBadge({ reason }: { reason: EndReason | null | undefined }) {
  if (!reason) return null;
  const label = END_REASON_LABELS[reason] || reason;
  const styleMap: Record<EndReason, string> = {
    completed: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    rejected_docs: 'text-red-700 bg-red-50 border-red-200',
    failed_interview: 'text-rose-800 bg-rose-50 border-rose-200',
    no_booking: 'text-amber-800 bg-amber-50 border-amber-200',
    expired_supplement: 'text-slate-700 bg-slate-100 border-slate-300',
    withdrawn: 'text-slate-700 bg-slate-100 border-slate-300',
  };

  const kindMap: Record<EndReason, StatusSemanticKind> = {
    completed: 'success',
    rejected_docs: 'rejected',
    failed_interview: 'rejected',
    no_booking: 'rejected',
    expired_supplement: 'rejected',
    withdrawn: 'withdrawn',
  };

  const detailMap: Record<EndReason, string> = {
    completed: 'Đã hoàn tất quy trình và phân công về Ban chuyên môn.',
    rejected_docs: 'Hồ sơ khép lại tại vòng xét duyệt đơn.',
    failed_interview: 'Hồ sơ khép lại sau vòng phỏng vấn.',
    no_booking: 'Hồ sơ khép lại do quá hạn 2 ngày không đặt lịch phỏng vấn.',
    expired_supplement: 'Hồ sơ khép lại do quá hạn hoặc quá số lần bổ sung thông tin.',
    withdrawn: 'Hồ sơ đã dừng theo yêu cầu rút đơn của ứng viên.',
  };

  return (
    <span
      title={`${label}: ${detailMap[reason] || ''}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md border whitespace-nowrap cursor-help ${styleMap[reason]}`}
    >
      <StatusKindIcon kind={kindMap[reason] || 'withdrawn'} className="w-3.5 h-3.5 shrink-0" />
      <span>Lý do kết thúc: {label}</span>
    </span>
  );
}

/**
 * Detailed status explanation callout box showing:
 * 1) Where the application currently is (stage & explanation)
 * 2) Who needs to perform the next action and what that action is
 */
export function StatusExplanation({
  status,
  viewerRole = 'hr',
  className = '',
}: {
  status: ApplicationStatus;
  viewerRole?: UserRole;
  className?: string;
}) {
  const meta = getStatusMeta(status, viewerRole);

  const actorBadgeColor =
    meta.nextActor === 'Đã kết thúc'
      ? 'bg-slate-200 text-slate-800'
      : viewerRole === 'candidate' && meta.nextActor === 'Ứng viên'
      ? 'bg-[#F36F00] text-white'
      : 'bg-slate-800 text-white';

  const actorDisplay =
    viewerRole === 'candidate' && meta.nextActor === 'Ứng viên'
      ? 'Bạn (Ứng viên)'
      : meta.nextActor;

  return (
    <div
      className={`p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs space-y-1.5 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-[#1E293B] flex items-center gap-1.5">
          <StatusKindIcon kind={meta.kind} className="w-3.5 h-3.5 text-[#F36F00]" />
          <span>Hồ sơ đang ở đâu:</span>
        </span>
        <span className="font-semibold text-slate-800">{meta.stage}</span>
        <span className="text-slate-500">—</span>
        <span className="text-slate-700">{meta.whereItIs}.</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-[#1E293B] flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-[#F36F00]" />
          <span>Ai thực hiện tiếp theo:</span>
        </span>
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${actorBadgeColor}`}>
          {actorDisplay}
        </span>
        <span className="text-slate-700 font-medium">{meta.nextAction}.</span>
      </div>
    </div>
  );
}

/**
 * Collapsible Status Guide / Legend tailored to each role's permissions.
 */
export function StatusLegendPanel({ viewerRole }: { viewerRole: UserRole }) {
  const [open, setOpen] = useState(false);

  const candidateGuideStatuses: ApplicationStatus[] = [
    'needs_supplement',
    'needs_review',
    'invited_to_book',
    'booked',
    'interviewing',
    'offer_sent',
    'confirmed_joined',
    'completed',
    'rejected_docs',
    'withdrawn',
  ];

  const hrGuideStatuses: ApplicationStatus[] = [
    'needs_supplement',
    'needs_review',
    'clear_fail',
    'invited_to_book',
    'booked',
    'interviewing',
    'scored',
    'decided_pass',
    'offer_sent',
    'confirmed_joined',
    'completed',
    'rejected_docs',
    'expired_supplement',
    'no_booking',
    'failed_interview',
    'withdrawn',
  ];

  const boardGuideStatuses: ApplicationStatus[] = [
    'booked',
    'interviewing',
    'scored',
    'decided_pass',
    'decided_fail',
    'offer_sent',
    'failed_interview',
    'confirmed_joined',
    'completed',
    'withdrawn',
  ];

  const targetStatuses =
    viewerRole === 'candidate'
      ? candidateGuideStatuses
      : viewerRole === 'board'
      ? boardGuideStatuses
      : hrGuideStatuses;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-[#1E293B]">
          <HelpCircle className="w-4 h-4 text-[#F36F00] shrink-0" />
          <span>
            Bảng giải thích trạng thái hồ sơ & người thực hiện bước tiếp theo ({targetStatuses.length} trạng thái)
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#F36F00] shrink-0">
          <span>{open ? 'Thu gọn chú giải' : 'Xem chú giải trạng thái'}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="p-4 border-t border-slate-200 bg-[#F8FAFC] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {targetStatuses.map((st) => {
            const meta = getStatusMeta(st, viewerRole);
            const nextLabel =
              viewerRole === 'candidate' && meta.nextActor === 'Ứng viên'
                ? 'Bạn (Ứng viên)'
                : meta.nextActor;
            return (
              <div
                key={st}
                className="p-3 rounded-lg bg-white border border-slate-200 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <StatusBadge status={st} viewerRole={viewerRole} />
                  <span className="text-[11px] font-mono font-semibold text-slate-600">
                    Tiếp theo: <strong className="text-[#1E293B]">{nextLabel}</strong>
                  </span>
                </div>
                <div className="text-slate-700 leading-relaxed">
                  <div>
                    <strong className="text-slate-900">Đang ở đâu:</strong> {meta.whereItIs}.
                  </div>
                  <div className="mt-0.5">
                    <strong className="text-slate-900">Việc cần làm:</strong> {meta.nextAction}.
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function formatRemainingTime(deadlineIso: string | null | undefined, systemNowIso: string): {
  text: string;
  isOverdue: boolean;
  isUrgent: boolean;
} {
  if (!deadlineIso) return { text: '—', isOverdue: false, isUrgent: false };
  const diffMs = new Date(deadlineIso).getTime() - new Date(systemNowIso).getTime();
  if (diffMs <= 0) {
    return { text: 'Đã quá hạn', isOverdue: true, isUrgent: true };
  }
  const totalHours = Math.floor(diffMs / (1000 * 3600));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const mins = Math.floor((diffMs % (1000 * 3600)) / (1000 * 60));

  if (days > 0) {
    return {
      text: `Còn ${days} ngày ${hours} giờ`,
      isOverdue: false,
      isUrgent: days === 0 && hours < 12,
    };
  }
  return {
    text: `Còn ${hours} giờ ${mins} phút`,
    isOverdue: false,
    isUrgent: hours < 12,
  };
}

