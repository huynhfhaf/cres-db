import React from 'react';
import type { ApplicationStatus, EndReason } from '../types';
import { STATUS_LABELS, END_REASON_LABELS } from '../types';

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const label = STATUS_LABELS[status] || status;

  const colorMap: Record<ApplicationStatus, string> = {
    submitted: 'bg-slate-100 text-slate-700 border-slate-200',
    checking: 'bg-slate-100 text-slate-700 border-slate-200',
    needs_supplement: 'bg-amber-50 text-amber-800 border-amber-200',
    supplement_submitted: 'bg-sky-50 text-sky-800 border-sky-200',
    expired_supplement: 'bg-slate-100 text-slate-600 border-slate-300',
    screening: 'bg-sky-50 text-sky-800 border-sky-200',
    clear_pass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    needs_review: 'bg-orange-50 text-[#C45800] border-orange-200',
    clear_fail: 'bg-rose-50 text-rose-800 border-rose-200',
    review_pass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    review_fail: 'bg-rose-50 text-rose-800 border-rose-200',
    rejected_docs: 'bg-red-50 text-red-700 border-red-200',
    invited_to_book: 'bg-orange-50 text-[#C45800] border-orange-200',
    booked: 'bg-sky-50 text-sky-800 border-sky-200',
    no_booking: 'bg-amber-50 text-amber-800 border-amber-200',
    interviewing: 'bg-orange-50 text-[#C45800] border-orange-200',
    scored: 'bg-sky-50 text-sky-800 border-sky-200',
    decided_pass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    decided_fail: 'bg-rose-50 text-rose-800 border-rose-200',
    failed_interview: 'bg-red-50 text-red-700 border-red-200',
    offer_sent: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    confirmed_joined: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    assigned: 'bg-orange-50 text-[#C45800] border-orange-200',
    completed: 'bg-emerald-600 text-white border-emerald-600',
    withdrawn: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md border whitespace-nowrap shrink-0 ${
        colorMap[status] || 'bg-slate-100 text-slate-700 border-slate-200'
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
    completed: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    rejected_docs: 'text-red-700 bg-red-50 border-red-200',
    failed_interview: 'text-rose-800 bg-rose-50 border-rose-200',
    no_booking: 'text-amber-800 bg-amber-50 border-amber-200',
    expired_supplement: 'text-slate-600 bg-slate-100 border-slate-200',
    withdrawn: 'text-slate-600 bg-slate-100 border-slate-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md border whitespace-nowrap ${styleMap[reason]}`}>
      {label}
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
