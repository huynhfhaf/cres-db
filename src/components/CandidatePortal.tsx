import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  Send,
  FileText,
  ExternalLink,
  UserCheck,
  Award,
  XCircle,
  Save,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../api';
import type {
  Application,
  RecruitmentRound,
  Department,
  InterviewSlot,
  AuditLogItem,
  NotificationItem,
  User,
} from '../types';
import { END_STATUSES } from '../types';
import { StatusBadge, EndReasonBadge, formatRemainingTime } from './StatusBadge';

interface CandidatePortalProps {
  user: User;
  round: RecruitmentRound;
  departments: Department[];
  systemNow: string;
  onRefreshGlobal: () => void;
}

const DRAFT_STORAGE_KEY = 'cres_candidate_form_draft_v1';

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Họ và tên',
  student_id: 'Mã số sinh viên (MSSV)',
  class_name: 'Lớp sinh hoạt (VD: 48K01.1)',
  email: 'Email liên hệ',
  phone: 'Số điện thoại',
  first_choice_dept_id: 'Ban nguyện vọng 1',
  experience: 'Kinh nghiệm hoạt động',
  essay: 'Câu hỏi tự luận (Động lực & Định hướng)',
};

export function CandidatePortal({
  user,
  round,
  departments,
  systemNow,
  onRefreshGlobal,
}: CandidatePortalProps) {
  const [app, setApp] = useState<Application | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Registration Form State
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    student_id: '231121521999',
    class_name: '49K01.1',
    email: user.email || '',
    phone: '0905888999',
    first_choice_dept_id: departments[0]?.id || '',
    second_choice_dept_id: departments[1]?.id || '',
    experience:
      'Từng tham gia điều phối sự kiện Chào tân sinh viên Khoa Kinh doanh Quốc tế DUE và thiết kế ấn phẩm truyền thông trên Canva, Photoshop.',
    essay:
      'Em mong muốn gia nhập CLB C-res để rèn luyện kỹ năng tổ chức sự kiện học thuật quy mô lớn tại Trường Đại học Kinh tế – ĐHĐN và đóng góp sức trẻ cho cộng đồng sinh viên.',
    cv_url: 'https://behance.net/ungvien-due',
    commitment_confirmed: true,
    is_active_student: true,
  });

  // Supplement Form State
  const [supplementValues, setSupplementValues] = useState<Record<string, string>>({});

  // Withdraw Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');

  const loadMyData = async () => {
    setLoading(true);
    try {
      const [meRes, slotsRes] = await Promise.all([
        apiRequest('/applications/me'),
        apiRequest('/slots'),
      ]);
      setApp(meRes.application);
      setAuditLogs(meRes.auditLogs || []);
      setNotifications(meRes.notifications || []);
      setSlots(slotsRes.slots || []);

      if (meRes.application) {
        const a: Application = meRes.application;
        setSupplementValues({
          full_name: a.full_name || '',
          student_id: a.student_id || '',
          class_name: a.class_name || '',
          email: a.email || '',
          phone: a.phone || '',
          first_choice_dept_id: a.first_choice_dept_id || '',
          experience: a.experience || '',
          essay: a.essay || '',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể tải dữ liệu hồ sơ',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore
      }
    }
    loadMyData();
  }, [user.id]);

  const handleSaveDraft = () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    setFeedback({ type: 'success', text: 'Đã lưu nháp đơn đăng ký trên trình duyệt.' });
  };

  const handleSubmitApplication = async (e: React.FormEvent, forceIncompleteDemo = false) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = forceIncompleteDemo
        ? {
            ...formData,
            phone: '',
            essay: '',
          }
        : formData;

      await apiRequest('/applications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setFeedback({
        type: 'success',
        text: forceIncompleteDemo
          ? 'Đã nộp hồ sơ thiếu SĐT & Tự luận — Hệ thống đã tự động chuyển sang Subprocess "Bổ sung hồ sơ" kèm Timer 2 ngày!'
          : 'Đã nộp hồ sơ thành công! Hệ thống đã tự động kiểm tra và sơ loại hồ sơ của bạn.',
      });
      await loadMyData();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi nộp đơn đăng ký',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiRequest(`/applications/${app.id}/supplement`, {
        method: 'POST',
        body: JSON.stringify(supplementValues),
      });
      setFeedback({
        type: 'success',
        text: 'Đã gửi thông tin bổ sung! Hệ thống đã tự động kiểm tra lại và cập nhật trạng thái hồ sơ.',
      });
      await loadMyData();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi gửi bổ sung hồ sơ',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookSlot = async (slotId: string) => {
    if (!app) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiRequest(`/applications/${app.id}/book`, {
        method: 'POST',
        body: JSON.stringify({ slotId }),
      });
      setFeedback({
        type: 'success',
        text: 'Đã đặt khung giờ phỏng vấn thành công! Các bộ đếm nhắc lịch/hủy lịch đã tự động dừng.',
      });
      await loadMyData();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể đặt khung giờ này',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!app) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiRequest(`/applications/${app.id}/check-in`, {
        method: 'POST',
      });
      setFeedback({
        type: 'success',
        text: 'Check-in buổi phỏng vấn thành công! Nhánh ứng viên của cổng song song (AND) đã hoàn tất.',
      });
      await loadMyData();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi check-in phỏng vấn',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmJoinGroup = async () => {
    if (!app) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiRequest('/confirm-join', {
        method: 'POST',
        body: JSON.stringify({ applicationId: app.id }),
      });
      setFeedback({
        type: 'success',
        text: 'Đã xác nhận tham gia CLB thành công! Bạn đã được mở khóa link nhóm sinh hoạt và chuyển sang bước Phân ban.',
      });
      await loadMyData();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi xác nhận tham gia',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiRequest(`/applications/${app.id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason: withdrawReason || 'Bận lịch cá nhân đột xuất' }),
      });
      setShowWithdrawModal(false);
      setFeedback({
        type: 'success',
        text: 'Đã ghi nhận rút đơn ứng tuyển, hủy toàn bộ timer và hoàn trả chỉ tiêu ban (nếu có).',
      });
      await loadMyData();
      onRefreshGlobal();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi rút đơn',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-24 bg-slate-200/70 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-200/70 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Timeline Steps Calculation for Existing Application
  const timelineSteps = [
    { key: 'step1', label: '1. Nộp & Kiểm tra hồ sơ' },
    { key: 'step2', label: '2. Sơ loại & Duyệt hồ sơ' },
    { key: 'step3', label: '3. Đặt lịch phỏng vấn' },
    { key: 'step4', label: '4. Phỏng vấn & Chấm điểm (Song song)' },
    { key: 'step5', label: '5. Kết quả & Xác nhận vào nhóm' },
    { key: 'step6', label: '6. Phân công Ban & Hoàn tất' },
  ];

  const getActiveStepIndex = (status: Application['status']) => {
    if (['submitted', 'checking', 'needs_supplement', 'supplement_submitted', 'expired_supplement'].includes(status))
      return 0;
    if (['screening', 'clear_pass', 'needs_review', 'clear_fail', 'review_pass', 'review_fail', 'rejected_docs'].includes(status))
      return 1;
    if (['invited_to_book', 'no_booking'].includes(status)) return 2;
    if (['booked', 'interviewing', 'scored'].includes(status)) return 3;
    if (['decided_pass', 'decided_fail', 'failed_interview', 'offer_sent', 'confirmed_joined'].includes(status))
      return 4;
    if (['assigned', 'completed'].includes(status)) return 5;
    return 0;
  };

  const activeStepIdx = app ? getActiveStepIndex(app.status) : 0;
  const isTerminated = app ? END_STATUSES.includes(app.status) : false;

  const deptAccentBorders = [
    'border-t-4 border-t-[#F36F00]',
    'border-t-4 border-t-[#68A225]',
    'border-t-4 border-t-[#31B5D8]',
    'border-t-4 border-t-[#FDD000]',
  ];

  return (
    <div className="space-y-6">
      {/* Round Banner with Official C-res Logo */}
      <div className="bg-white border border-[#435B61]/20 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <img
              src="/assets/aistudio/C-RES_C__VI_N__1__e8c78418.png"
              alt="Logo CLB C-res"
              className="h-14 w-auto object-contain shrink-0"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F36F00]">
                <span>CLB C-RES · TRƯỜNG ĐẠI HỌC KINH TẾ – ĐẠI HỌC ĐÀ NẴNG</span>
                <span>·</span>
                <span className="text-[#53821D]">ĐỢT TUYỂN ĐANG MỞ</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#26383C]">{round.name}</h1>
              <p className="text-sm text-[#435B61]">{round.event_name}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#435B61] tabular-nums">
            <div className="bg-white border border-[#31B5D8]/40 rounded-lg px-3.5 py-2">
              <div className="text-[#435B61]">Ngưỡng Đạt rõ / Loại rõ</div>
              <div className="font-bold text-[#146D85]">
                X = {round.threshold_x}đ · Y = {round.threshold_y}đ
              </div>
            </div>
            <div className="bg-white border border-[#F36F00]/40 rounded-lg px-3.5 py-2">
              <div className="text-[#435B61]">Hạn bổ sung / Đặt lịch</div>
              <div className="font-bold text-[#C45800]">
                {round.supplement_deadline_days} ngày (tối đa {round.supplement_max_rounds} lần) · Nhắc {round.remind_after_days}d / Hủy {round.unbook_after_days}d
              </div>
            </div>
          </div>
        </div>

        {/* 4 Departments Overview with 4 C-res Logo Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#435B61]/15">
          {departments.map((d, idx) => (
            <div
              key={d.id}
              className={`bg-white border border-[#435B61]/20 ${
                deptAccentBorders[idx % deptAccentBorders.length]
              } rounded-lg p-3.5`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-[#26383C]">{d.name}</span>
                <span className="text-xs font-mono font-bold text-[#F36F00] tabular-nums">
                  Chỉ tiêu: {d.remaining_quota ?? d.quota}/{d.quota}
                </span>
              </div>
              <p className="text-xs text-[#435B61] line-clamp-2">{d.description}</p>
            </div>
          ))}
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

      {/* CASE A: Candidate has NOT submitted an application yet -> Registration Form */}
      {!app ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-5 mb-6 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bước 1: Điền Form Đăng Ký Ứng Tuyển CTV C-res
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Sau khi nộp, hệ thống tự động kiểm tra trường bắt buộc trên Sheet và sơ loại theo ngưỡng X/Y ngay lập tức.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              Lưu nháp
            </button>
          </div>

          <form onSubmit={(e) => handleSubmitApplication(e, false)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="cand-fullname" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Họ và tên <span className="text-red-600">*</span>
                </label>
                <input
                  id="cand-fullname"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <label htmlFor="cand-sid" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mã số sinh viên (MSSV DUE) <span className="text-red-600">*</span>
                </label>
                <input
                  id="cand-sid"
                  type="text"
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="221121521101"
                />
              </div>
              <div>
                <label htmlFor="cand-class" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Lớp sinh hoạt <span className="text-red-600">*</span>
                </label>
                <input
                  id="cand-class"
                  type="text"
                  value={formData.class_name}
                  onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="48K01.1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="cand-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email liên hệ <span className="text-red-600">*</span>
                </label>
                <input
                  id="cand-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="ten@due.udn.vn"
                />
              </div>
              <div>
                <label htmlFor="cand-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Số điện thoại <span className="text-red-600">*</span>
                </label>
                <input
                  id="cand-phone"
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="0905123456"
                />
              </div>
              <div>
                <label htmlFor="cand-cv" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Link CV / Portfolio (Tùy chọn — cộng điểm sơ loại)
                </label>
                <input
                  id="cand-cv"
                  type="text"
                  value={formData.cv_url}
                  onChange={(e) => setFormData({ ...formData, cv_url: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="https://behance.net/..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cand-dept1" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ban Nguyện vọng 1 <span className="text-red-600">*</span>
                </label>
                <select
                  id="cand-dept1"
                  value={formData.first_choice_dept_id}
                  onChange={(e) => setFormData({ ...formData, first_choice_dept_id: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Chọn Ban Nguyện vọng 1 --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (Chỉ tiêu: {d.quota})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cand-dept2" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ban Nguyện vọng 2 (Tùy chọn)
                </label>
                <select
                  id="cand-dept2"
                  value={formData.second_choice_dept_id}
                  onChange={(e) => setFormData({ ...formData, second_choice_dept_id: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Không chọn Nguyện vọng 2 --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="cand-exp" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kinh nghiệm hoạt động ngoại khóa / chuyên môn <span className="text-red-600">*</span>
              </label>
              <textarea
                id="cand-exp"
                rows={3}
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Mô tả các hoạt động CLB, sự kiện, kỹ năng thiết kế, viết bài, hậu cần hoặc đối ngoại..."
              />
            </div>

            <div>
              <label htmlFor="cand-essay" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Câu hỏi tự luận: Vì sao bạn chọn CLB C-res và định hướng đóng góp của bạn? <span className="text-red-600">*</span>
              </label>
              <textarea
                id="cand-essay"
                rows={3}
                value={formData.essay}
                onChange={(e) => setFormData({ ...formData, essay: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Chia sẻ góc nhìn và mong muốn của bạn (Phần tự luận sẽ được Ban Nhân sự trực tiếp xem xét ở nhánh Cần xem xét)..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active_student}
                  onChange={(e) => setFormData({ ...formData, is_active_student: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                Tôi xác nhận là sinh viên đang theo học tại ĐH Kinh tế – ĐHĐN (Điều kiện cứng)
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.commitment_confirmed}
                  onChange={(e) => setFormData({ ...formData, commitment_confirmed: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                Tôi cam kết đảm bảo thời gian tham gia chuỗi sự kiện của CLB C-res (Điều kiện cứng)
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                disabled={submitting}
                onClick={(e) => handleSubmitApplication(e, true)}
                className="px-4 py-2.5 text-xs font-bold text-[#7A6000] bg-[#FDD000]/30 hover:bg-[#FDD000]/45 border border-[#E5BC00] rounded-lg transition-colors whitespace-nowrap"
              >
                Nộp thử thiếu trường (Test Subprocess Bổ sung 2 ngày)
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Đang xử lý...' : 'Nộp hồ sơ ứng tuyển'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* CASE B: Candidate HAS an application -> "Hồ sơ của tôi" Timeline & Action Workspace */
        <div className="space-y-6">
          {/* Status Header Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold text-slate-900">
                    Hồ sơ của tôi: {app.full_name}
                  </h2>
                  <StatusBadge status={app.status} />
                  <EndReasonBadge reason={app.end_reason} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
                  <span>MSSV: {app.student_id || 'Chưa nhập'}</span>
                  <span>·</span>
                  <span>Lớp: {app.class_name || 'Chưa nhập'}</span>
                  <span>·</span>
                  <span>NV1: {app.first_choice_name}</span>
                  {app.second_choice_name && (
                    <>
                      <span>·</span>
                      <span>NV2: {app.second_choice_name}</span>
                    </>
                  )}
                  {app.screening_score !== null && (
                    <>
                      <span>·</span>
                      <span className="font-semibold text-blue-700">
                        Điểm sơ loại: {app.screening_score}đ
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Withdraw Button available at ANY step before completion */}
              {!isTerminated && (
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <XCircle className="w-4 h-4" />
                  Rút đơn ứng tuyển
                </button>
              )}
            </div>

            {/* 6-Step Progress Timeline */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-5">
              {timelineSteps.map((step, idx) => {
                const isDone = idx < activeStepIdx || app.status === 'completed';
                const isCurrent = idx === activeStepIdx && app.status !== 'completed';
                return (
                  <div
                    key={step.key}
                    className={`p-3 rounded-lg border text-xs transition-colors ${
                      isDone
                        ? 'bg-[#68A225]/12 border-[#68A225]/40 text-[#3F6513]'
                        : isCurrent
                        ? 'bg-[#F36F00]/12 border-[#F36F00] text-[#26383C] font-bold'
                        : 'bg-white border-[#435B61]/20 text-[#435B61]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[11px] uppercase">Bước {idx + 1}</span>
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-[#68A225] shrink-0" />}
                      {isCurrent && <Clock className="w-3.5 h-3.5 text-[#F36F00] shrink-0" />}
                    </div>
                    <div className="leading-snug">{step.label.replace(/^\d+\.\s*/, '')}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DYNAMIC ACTION PANEL BASED ON CURRENT STATE */}

          {/* 1. SUBPROCESS: BỔ SUNG HỒ SƠ (needs_supplement) */}
          {app.status === 'needs_supplement' && (
            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Subprocess: Bổ sung hồ sơ thiếu thông tin</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Hệ thống phát hiện hồ sơ của bạn còn thiếu trường bắt buộc. Chỉ hiển thị các trường đang thiếu bên dưới để bạn bổ sung nhanh.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                  <span className="px-3 py-1.5 text-xs font-bold bg-white border border-amber-300 rounded-lg text-amber-900">
                    Lần bổ sung {app.supplement_count + 1}/{round.supplement_max_rounds}
                  </span>
                  <span className="px-3 py-1.5 text-xs font-mono font-bold bg-amber-600 text-white rounded-lg">
                    Hạn 2 ngày: {formatRemainingTime(app.supplement_deadline_at, systemNow).text}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmitSupplement} className="bg-white border border-amber-200 rounded-lg p-5 space-y-4">
                <div className="text-xs font-semibold text-slate-700">
                  Các trường cần bổ sung ({app.missing_fields?.length || 0} trường):
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(app.missing_fields && app.missing_fields.length > 0
                    ? app.missing_fields
                    : ['phone', 'experience', 'essay']
                  ).map((fieldKey) => (
                    <div key={fieldKey} className={fieldKey === 'essay' || fieldKey === 'experience' ? 'md:col-span-2' : ''}>
                      <label
                        htmlFor={`supp-${fieldKey}`}
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        {FIELD_LABELS[fieldKey] || fieldKey} <span className="text-red-600">* (Đang thiếu)</span>
                      </label>
                      {fieldKey === 'essay' || fieldKey === 'experience' ? (
                        <textarea
                          id={`supp-${fieldKey}`}
                          rows={3}
                          value={supplementValues[fieldKey] || ''}
                          onChange={(e) =>
                            setSupplementValues({ ...supplementValues, [fieldKey]: e.target.value })
                          }
                          placeholder={`Nhập bổ sung ${FIELD_LABELS[fieldKey] || fieldKey}...`}
                          className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      ) : (
                        <input
                          id={`supp-${fieldKey}`}
                          type="text"
                          value={supplementValues[fieldKey] || ''}
                          onChange={(e) =>
                            setSupplementValues({ ...supplementValues, [fieldKey]: e.target.value })
                          }
                          placeholder={`Nhập bổ sung ${FIELD_LABELS[fieldKey] || fieldKey}...`}
                          className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Lưu ý: Nếu gửi vẫn thiếu quá {round.supplement_max_rounds} lần hoặc để quá hạn 2 ngày, hệ thống sẽ tự động loại hồ sơ.
                  </span>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Đang gửi...' : 'Gửi hồ sơ bổ sung'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 2. STEP 8: INTERVIEW SLOT BOOKING (invited_to_book or booked) */}
          {(app.status === 'invited_to_book' || app.status === 'booked') && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <span>
                      {app.status === 'invited_to_book'
                        ? 'Bước 8: Chọn khung giờ phỏng vấn (Chỉ hiển thị khung giờ còn chỗ)'
                        : 'Lịch phỏng vấn đã đặt & Check-in tại buổi phỏng vấn'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {app.status === 'invited_to_book'
                      ? 'Sau 1 ngày chưa đặt lịch hệ thống sẽ nhắc 1 lần; sau 2 ngày chưa đặt lịch hệ thống sẽ tự động gạch tên.'
                      : 'Bạn có thể bấm Check-in khi có mặt tại phòng phỏng vấn hoặc đổi sang khung giờ khác còn chỗ trước giờ bắt đầu.'}
                  </p>
                </div>

                {app.status === 'invited_to_book' && app.schedule_deadline_at && (
                  <div className="px-3.5 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs font-mono font-semibold text-orange-900 tabular-nums shrink-0">
                    Hạn đặt lịch (2 ngày): {formatRemainingTime(app.schedule_deadline_at, systemNow).text}
                  </div>
                )}
              </div>

              {/* Current Booking Banner + Check-in Button */}
              {app.booking && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-blue-800">Khung giờ đã đặt của bạn:</div>
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      {app.booking.start_at ? new Date(app.booking.start_at).toLocaleString('vi-VN') : ''} —{' '}
                      {app.booking.location_or_link}
                    </div>
                    <div className="text-xs text-slate-600">
                      Trạng thái Check-in:{' '}
                      {app.booking.checked_in_at ? (
                        <span className="font-semibold text-emerald-700">
                          Đã check-in lúc {new Date(app.booking.checked_in_at).toLocaleString('vi-VN')}
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700">Chưa check-in</span>
                      )}
                    </div>
                  </div>
                  {!app.booking.checked_in_at && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleCheckIn}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <UserCheck className="w-4 h-4" />
                      Check-in tham gia phỏng vấn ngay
                    </button>
                  )}
                </div>
              )}

              {/* Available Interview Slots Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {slots
                  .filter((s) => (s.booked_count || 0) < s.capacity || app.booking?.slot_id === s.id)
                  .map((slot) => {
                    const isMySlot = app.booking?.slot_id === slot.id;
                    const bookedCnt = slot.booked_count || 0;
                    const rem = Math.max(0, slot.capacity - bookedCnt);
                    const isPast = new Date(slot.start_at).getTime() <= new Date(systemNow).getTime();

                    return (
                      <div
                        key={slot.id}
                        className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                          isMySlot
                            ? 'bg-blue-50/60 border-blue-400'
                            : isPast
                            ? 'bg-slate-50 border-slate-200 opacity-65'
                            : 'bg-white border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
                              {new Date(slot.start_at).toLocaleDateString('vi-VN')}
                            </span>
                            <span className="text-xs font-mono text-blue-700 font-semibold tabular-nums">
                              Còn {rem}/{slot.capacity} chỗ
                            </span>
                          </div>
                          <div className="text-sm font-bold text-slate-900 tabular-nums">
                            {new Date(slot.start_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            –{' '}
                            {new Date(slot.end_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-xs text-slate-600">{slot.location_or_link}</div>
                        </div>

                        <button
                          type="button"
                          disabled={submitting || isMySlot || isPast || Boolean(app.booking?.checked_in_at)}
                          onClick={() => handleBookSlot(slot.id)}
                          className={`w-full py-2 px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                            isMySlot
                              ? 'bg-emerald-600 text-white cursor-default'
                              : isPast
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {isMySlot
                            ? 'Đã chọn khung giờ này'
                            : isPast
                            ? 'Đã qua giờ bắt đầu'
                            : app.booking
                            ? 'Đổi sang khung giờ này'
                            : 'Chọn khung giờ này'}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 3. PARALLEL INTERVIEWING / SCORED STATUS */}
          {(app.status === 'interviewing' || app.status === 'scored' || app.status === 'decided_pass' || app.status === 'decided_fail') && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                Trạng thái Phỏng vấn & Chấm điểm song song (AND-join)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Nhánh 1 (Ứng viên Check-in):</div>
                  <div className="text-sm font-semibold text-emerald-700 mt-1">
                    {app.booking?.checked_in_at
                      ? `Đã check-in (${new Date(app.booking.checked_in_at).toLocaleString('vi-VN')})`
                      : 'Chưa check-in'}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Nhánh 2 (Ban Chủ nhiệm chấm phiếu điểm):</div>
                  <div className="text-sm font-semibold text-blue-700 mt-1 tabular-nums">
                    Đã nhận {app.scorecards?.length || 0}/{round.min_scorecards_per_interview} phiếu chấm điểm tối thiểu
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Hệ thống xử lý từng ứng viên ngay khi hội tụ đủ Check-in và số phiếu điểm mà không bắt bạn phải chờ toàn bộ đợt phỏng vấn kết thúc.Kết quả chính thức sẽ được gửi ngay khi Ban Chủ nhiệm bấm "Chốt và gửi".
              </p>
            </div>
          )}

          {/* 4. STEP 12: OFFER SENT -> 1-CLICK CONFIRM & JOIN GROUP */}
          {app.status === 'offer_sent' && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-lg">
                    <Award className="w-6 h-6 text-emerald-600" />
                    <span>Chúc mừng bạn đã ĐẬU vòng Phỏng vấn CLB C-res!</span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Bước 12 (Gộp một bước duy nhất): Hãy bấm nút "Xác nhận và tham gia nhóm" bên dưới để xác nhận làm CTV và nhận ngay đường dẫn nhóm sinh hoạt chung.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmJoinGroup}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? 'Đang xác nhận...' : 'Xác nhận và tham gia nhóm ngay'}
                </button>
              </div>
            </div>
          )}

          {/* 5. STEP 12-14: CONFIRMED JOINED / ASSIGNED / COMPLETED */}
          {['confirmed_joined', 'assigned', 'completed'].includes(app.status) && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <span>Nhóm sinh hoạt CLB & Thông tin Phân công Ban</span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Bạn đã xác nhận tham gia CLB C-res. Dưới đây là đường dẫn nhóm chính thức và kết quả phân ban.
                  </p>
                </div>
                <a
                  href={round.group_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Mở nhóm Zalo/Discord CLB ({round.group_link})
                </a>
              </div>

              {app.assignment && app.assignment.status === 'confirmed' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-emerald-800">
                    Ban phân công chính thức (Đã được Ban Nhân sự chốt):
                  </div>
                  <div className="text-lg font-bold text-emerald-950">
                    {app.assignment.department_name}
                  </div>
                  {app.assignment.ai_reason && (
                    <p className="text-xs text-emerald-800">
                      Đánh giá phù hợp: {app.assignment.ai_reason}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
                  Ban Nhân sự đang rà soát gợi ý từ AI để phân công vị trí/ban phù hợp nhất với điểm số và nguyện vọng của bạn.
                </div>
              )}
            </div>
          )}

          {/* Notifications & Audit Trail for Candidate */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Hộp thư Thông báo của tôi ({notifications.length})</span>
              </h3>
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500">Chưa có thông báo nào.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">{n.subject}</span>
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                          {new Date(n.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-line">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Lịch sử chuyển trạng thái & Audit Log ({auditLogs.length})</span>
              </h3>
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-blue-700">{log.action}</span>
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {new Date(log.created_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <div className="text-slate-800">{log.result}</div>
                    <div className="text-[11px] text-slate-500 font-mono">Luật: {log.rule_applied}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Confirmation Modal */}
      {showWithdrawModal && app && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận rút đơn ứng tuyển"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Xác nhận Rút đơn ứng tuyển (Ngoại lệ toàn quy trình)
            </h3>
            <p className="text-xs text-slate-600">
              Khi bạn bấm xác nhận rút đơn, hệ thống sẽ tự động hủy toàn bộ bộ đếm giờ đang chạy của hồ sơ này. Nếu bạn đã được phân công vào ban, hệ thống sẽ tự động hoàn tác phân công để trả lại chỉ tiêu cho ban.
            </p>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label htmlFor="withdraw-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do rút đơn <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="withdraw-reason"
                  rows={3}
                  required
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="Nhập lý do rút đơn (VD: Trùng lịch học quân sự / Bận việc gia đình)..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  {submitting ? 'Đang xử lý...' : 'Xác nhận Rút đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
