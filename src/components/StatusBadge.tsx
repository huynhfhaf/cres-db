import React from 'react';
import type { ApplicationStatus, EndReason } from '../types';
import { STATUS_LABELS, END_REASON_LABELS } from '../types';

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const label = STATUS_LABELS[status] || status;

  const colorMap: Record<ApplicationStatus, string> = {
    submitted: 'bg-[#435B61]/10 text-[#435B61] border-[#435B61]/30',
    checking: 'bg-[#31B5D8]/12 text-[#16748E] border-[#31B5D8]/40',
    needs_supplement: 'bg-[#FDD000]/25 text-[#856700] border-[#FDD000]',
    supplement_submitted: 'bg-[#31B5D8]/12 text-[#16748E] border-[#31B5D8]/40',
    expired_supplement: 'bg-[#435B61]/15 text-[#435B61] border-[#435B61]/40',
    screening: 'bg-[#31B5D8]/12 text-[#16748E] border-[#31B5D8]/40',
    clear_pass: 'bg-[#68A225]/12 text-[#426915] border-[#68A225]/40',
    needs_review: 'bg-[#F36F00]/12 text-[#C45800] border-[#F36F00]/40',
    clear_fail: 'bg-rose-50 text-rose-800 border-rose-300',
    review_pass: 'bg-[#68A225]/12 text-[#426915] border-[#68A225]/40',
    review_fail: 'bg-rose-50 text-rose-800 border-rose-300',
    rejected_docs: 'bg-red-50 text-red-800 border-red-300',
    invited_to_book: 'bg-[#31B5D8]/15 text-[#146D85] border-[#31B5D8]/45',
    booked: 'bg-[#31B5D8]/20 text-[#0F5C70] border-[#31B5D8]/50',
    no_booking: 'bg-[#FDD000]/25 text-[#856700] border-[#FDD000]',
    interviewing: 'bg-[#F36F00]/15 text-[#B85200] border-[#F36F00]/40',
    scored: 'bg-[#31B5D8]/15 text-[#146D85] border-[#31B5D8]/45',
    decided_pass: 'bg-[#68A225]/15 text-[#3F6513] border-[#68A225]/45',
    decided_fail: 'bg-rose-100 text-rose-900 border-rose-300',
    failed_interview: 'bg-red-100 text-red-900 border-red-300',
    offer_sent: 'bg-[#68A225]/15 text-[#3F6513] border-[#68A225]/45',
    confirmed_joined: 'bg-[#31B5D8]/15 text-[#146D85] border-[#31B5D8]/45',
    assigned: 'bg-[#F36F00]/15 text-[#B85200] border-[#F36F00]/45',
    completed: 'bg-[#68A225] text-white border-[#588A1E]',
    withdrawn: 'bg-[#435B61]/15 text-[#435B61] border-[#435B61]/35',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded border whitespace-nowrap shrink-0 ${
        colorMap[status] || 'bg-white text-[#435B61] border-[#435B61]/30'
      }`}
    >
      {label}
    </span>
  );
}

export function EndReasonBadge({ reason }: { reason: EndReason | null | undefined }) {
  if (!reason) return null;
  const label = END_REASON_LABELS[reason] || reason;
  const styleMap: Record<EndReason, string> = {
    completed: 'text-[#426915] bg-[#68A225]/12 border-[#68A225]/40',
    rejected_docs: 'text-red-700 bg-red-50 border-red-200',
    failed_interview: 'text-[#C45800] bg-[#F36F00]/12 border-[#F36F00]/40',
    no_booking: 'text-[#856700] bg-[#FDD000]/25 border-[#FDD000]',
    expired_supplement: 'text-[#435B61] bg-[#435B61]/12 border-[#435B61]/35',
    withdrawn: 'text-[#435B61] bg-[#435B61]/10 border-[#435B61]/30',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border whitespace-nowrap ${styleMap[reason]}`}>
      Kết thúc: {label}
    </span>
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
