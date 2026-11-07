import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  LogOut,
  UserCircle2,
  Users,
  Award,
  LayoutDashboard,
  Search,
  ChevronRight,
  ChevronDown,
  UserPlus,
  Settings,
  Shield,
  ExternalLink,
  X,
} from 'lucide-react';
import { apiRequest, getStoredToken, setStoredToken } from './api';
import type {
  User,
  UserRole,
  RecruitmentRound,
  Department,
  NotificationItem,
  ApplicationStatus,
} from './types';
import { StatusBadge, getStatusMeta } from './components/StatusBadge';
import { UserRoleBadge, UserAccountInfo } from './components/UserRoleBadge';
import { CandidatePortal } from './components/CandidatePortal';
import { HrPortal } from './components/HrPortal';
import { BoardPortal } from './components/BoardPortal';
import { DashboardAndAdmin } from './components/DashboardAndAdmin';

const CRES_LOGO_PATH = '/assets/aistudio/C-RES_C__VI_N__1__e8c78418.png';
const CRES_FACEBOOK_URL = 'https://www.facebook.com/CRESclub.2710?locale=vi_VN';

function FacebookIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [round, setRound] = useState<RecruitmentRound | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [systemNow, setSystemNow] = useState<string>(new Date().toISOString());
  const [loading, setLoading] = useState(true);

  // Active Navigation View
  const [activeView, setActiveView] = useState<
    'candidate' | 'hr' | 'board' | 'dashboard' | 'admin'
  >('dashboard');

  // Demo accounts list for candidate selection on Login screen
  const [demoCandidates, setDemoCandidates] = useState<
    Array<User & { status: string; student_id: string }>
  >([]);
  const [showCandidateListOnLogin, setShowCandidateListOnLogin] = useState(false);
  const [showInternalClubLogin, setShowInternalClubLogin] = useState(false);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');

  // Auth Screen state (when logged out)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [authFullName, setAuthFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Modals
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const fetchRoundAndDemoAccounts = useCallback(async () => {
    const [roundRes, demoRes] = await Promise.all([
      apiRequest('/rounds/current'),
      apiRequest('/auth/demo-accounts'),
    ]);
    setRound(roundRes.round);
    setDepartments(roundRes.departments || []);
    setSystemNow(roundRes.systemNow || new Date().toISOString());
    setDemoCandidates(demoRes.sampleCandidates || []);
  }, []);

  const syncDefaultViewForRole = (role: UserRole) => {
    const nextView =
      role === 'candidate'
        ? 'candidate'
        : role === 'hr'
        ? 'hr'
        : role === 'board'
        ? 'board'
        : 'dashboard';
    setActiveView(nextView);
    localStorage.setItem('cres_active_view', nextView);
  };

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      try {
        await fetchRoundAndDemoAccounts();
        const existingToken = getStoredToken();
        if (existingToken) {
          try {
            const me = await apiRequest('/auth/me');
            setUser(me.user);
            const savedView = localStorage.getItem('cres_active_view') as typeof activeView | null;
            if (
              savedView &&
              ((me.user.role === 'admin' && (savedView === 'dashboard' || savedView === 'admin')) ||
                (me.user.role === 'hr' && savedView === 'hr') ||
                (me.user.role === 'board' && savedView === 'board') ||
                (me.user.role === 'candidate' && savedView === 'candidate'))
            ) {
              setActiveView(savedView);
            } else {
              syncDefaultViewForRole(me.user.role);
            }
            return;
          } catch {
            setStoredToken(null);
            localStorage.removeItem('cres_active_view');
          }
        }
      } catch (err) {
        console.error('Bootstrap error:', err);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [fetchRoundAndDemoAccounts]);

  useEffect(() => {
    const handleSync = () => {
      fetchRoundAndDemoAccounts();
    };
    window.addEventListener('cres-data-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('cres-data-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [fetchRoundAndDemoAccounts]);

  const handleDemoSwitch = async (target: { role?: UserRole; email?: string }, targetView?: typeof activeView) => {
    try {
      const res = await apiRequest('/auth/demo', {
        method: 'POST',
        body: JSON.stringify(target),
      });
      setStoredToken(res.token);
      setUser(res.user);
      setShowCandidateListOnLogin(false);
      setShowInternalClubLogin(false);
      if (targetView) {
        setActiveView(targetView);
        localStorage.setItem('cres_active_view', targetView);
      } else {
        syncDefaultViewForRole(res.user.role);
      }
      await fetchRoundAndDemoAccounts();
    } catch (err) {
      console.error('Demo switch failed:', err);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setConfirmPasswordError(null);

    if (authMode === 'register' && authPassword !== authConfirmPassword) {
      setConfirmPasswordError('Mật khẩu xác nhận không khớp với mật khẩu đã nhập.');
      return;
    }

    try {
      const path = authMode === 'login' ? '/auth/login' : '/auth/register';
      const body =
        authMode === 'login'
          ? { email: authEmail, password: authPassword }
          : { email: authEmail, password: authPassword, full_name: authFullName };
      const res = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setStoredToken(res.token);
      setUser(res.user);
      syncDefaultViewForRole(res.user.role);
      await fetchRoundAndDemoAccounts();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Thông tin đăng nhập chưa chính xác');
    }
  };

  const handleLogout = () => {
    setStoredToken(null);
    localStorage.removeItem('cres_active_view');
    setUser(null);
    setAuthEmail('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setConfirmPasswordError(null);
    setShowCandidateListOnLogin(false);
    setShowInternalClubLogin(false);
  };

  const handleOpenNotifDrawer = async () => {
    setShowNotifDrawer(true);
    try {
      const res = await apiRequest('/notifications');
      setNotifications(res.notifications || []);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 gap-3">
        <img
          src={CRES_LOGO_PATH}
          alt="Logo Câu lạc bộ Thương mại C-RES"
          className="h-16 w-auto object-contain"
        />
        <div className="text-sm font-semibold text-slate-600">
          Đang tải trang tuyển dụng Câu lạc bộ Thương mại C-RES...
        </div>
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATION SCREEN (CANDIDATE-FOCUSED + COLLAPSIBLE INTERNAL CLUB PORTAL)
  // ============================================================================
  if (!user) {
    const filteredLoginCandidates = demoCandidates.filter((c) => {
      if (!candidateSearchQuery.trim()) return true;
      const q = candidateSearchQuery.toLowerCase();
      const statusLabel = c.status
        ? getStatusMeta(c.status as ApplicationStatus, 'candidate').label.toLowerCase()
        : 'chưa nộp đơn';
      return (
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.student_id && c.student_id.toLowerCase().includes(q)) ||
        statusLabel.includes(q)
      );
    });

    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 leading-relaxed">
        <div className="max-w-5xl w-full mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Column: C-RES Branding, 3 Departments & Candidate Profile Selector */}
            <div className="lg:col-span-7 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={CRES_LOGO_PATH}
                      alt="Logo Câu lạc bộ Thương mại C-RES"
                      className="h-14 w-auto object-contain"
                    />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-[#F36F00]">
                        Đại học Kinh tế - Đại học Đà Nẵng
                      </div>
                      <div className="text-sm font-bold text-[#1E293B]">
                        Câu lạc bộ Thương mại C-RES
                      </div>
                    </div>
                  </div>

                  <a
                    href={CRES_FACEBOOK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-orange-50/50 border border-slate-200 hover:border-[#F36F00] text-xs font-semibold text-[#1E293B] hover:text-[#F36F00] transition-colors"
                  >
                    <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
                    <span>Fanpage C-RES</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E293B] leading-snug pt-1">
                  Cổng Tuyển Cộng Tác Viên Câu lạc bộ Thương mại C-RES
                </h1>

                {/* 3 Departments Quick Pills for Candidates */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {(departments.length > 0
                    ? departments
                    : [
                        { id: 'dept-media', name: 'Ban Truyền thông', quota: 8 },
                        { id: 'dept-hr', name: 'Ban Nhân sự', quota: 7 },
                        { id: 'dept-business', name: 'Ban Kinh doanh', quota: 7 },
                      ]
                  ).map((d) => (
                    <div
                      key={d.id}
                      className="px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-bold text-[#1E293B]">{d.name}</span>
                      <span className="text-[11px] font-semibold text-[#F36F00] bg-orange-50 px-2 py-0.5 rounded border border-orange-200 tabular-nums">
                        {d.quota} CTV
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Candidate-Only Quick Lookup Section */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#F36F00]" />
                    Dành cho Ứng viên / Cộng tác viên:
                  </div>
                  {showCandidateListOnLogin && (
                    <button
                      type="button"
                      onClick={() => setShowCandidateListOnLogin(false)}
                      className="text-xs font-semibold text-[#F36F00] hover:underline"
                    >
                      Thu gọn danh sách
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowCandidateListOnLogin((prev) => !prev)}
                  aria-expanded={showCandidateListOnLogin}
                  className={`w-full p-4 text-left rounded-xl transition-all border flex items-center justify-between ${
                    showCandidateListOnLogin
                      ? 'bg-[#F36F00] text-white border-[#F36F00] shadow-xs'
                      : 'bg-white hover:border-[#F36F00] hover:bg-orange-50/30 border-[#F36F00] text-[#1E293B]'
                  }`}
                >
                  <div>
                    <div
                      className={`text-sm font-bold flex items-center gap-2 ${
                        showCandidateListOnLogin ? 'text-white' : 'text-[#F36F00]'
                      }`}
                    >
                      <UserCircle2 className="w-4 h-4 shrink-0" />
                      <span>Tra cứu Hồ sơ Ứng viên ({demoCandidates.length} hồ sơ)</span>
                    </div>
                    <div
                      className={`text-xs mt-0.5 ${
                        showCandidateListOnLogin ? 'text-white/90' : 'text-slate-600'
                      }`}
                    >
                      Bấm vào đây để xem tiến độ hồ sơ, đặt lịch phỏng vấn hoặc xác nhận tham gia CLB
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      showCandidateListOnLogin ? 'rotate-90 text-white' : 'text-[#F36F00]'
                    }`}
                  />
                </button>

                {/* Expandable Candidate List when clicking "Tra cứu Hồ sơ Ứng viên" */}
                {showCandidateListOnLogin && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-xs font-bold text-[#1E293B]">
                        Danh sách Ứng viên ({filteredLoginCandidates.length}/{demoCandidates.length} bạn)
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setAuthError(null);
                          setConfirmPasswordError(null);
                          setShowCandidateListOnLogin(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F36F00] text-white hover:bg-[#D96200] text-xs font-semibold transition-colors w-fit"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Đăng ký tài khoản mới</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={candidateSearchQuery}
                        onChange={(e) => setCandidateSearchQuery(e.target.value)}
                        placeholder="Tìm theo họ tên, MSSV, email hoặc trạng thái..."
                        aria-label="Tìm kiếm ứng viên"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                      />
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                      {demoCandidates.length === 0 ? (
                        <div className="p-5 text-center text-xs text-slate-600 space-y-2">
                          <div className="font-semibold text-[#1E293B]">
                            Hiện chưa có ứng viên nào trong danh sách.
                          </div>
                          <div>
                            Bạn hãy bấm nút <strong>"+ Đăng ký tài khoản mới"</strong> hoặc điền form <strong>"Đăng ký Ứng viên mới"</strong> ở cột bên phải để tự tạo ứng viên và kiểm thử quy trình nhé!
                          </div>
                        </div>
                      ) : filteredLoginCandidates.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Không tìm thấy bạn ứng viên nào phù hợp với từ khóa.
                        </div>
                      ) : (
                        filteredLoginCandidates.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleDemoSwitch({ email: c.email }, 'candidate')}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-orange-50/40 transition-colors flex items-center justify-between gap-2 group"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#1E293B] group-hover:text-[#F36F00] truncate">
                                {c.full_name}{' '}
                                {c.student_id && (
                                  <span className="text-[11px] font-normal text-slate-500 tabular-nums">
                                    ({c.student_id})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{c.email}</div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {c.status ? (
                                <StatusBadge status={c.status as ApplicationStatus} viewerRole="candidate" />
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Chưa nộp đơn
                                </span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#F36F00]" />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Candidate Login / Register Form + Subtle Bottom Toggle for Internal Club Members */}
            <div className="lg:col-span-5 p-6 sm:p-8 bg-white flex flex-col justify-between space-y-5">
              <div className="space-y-5">
                <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1 rounded-lg w-fit border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError(null);
                      setConfirmPasswordError(null);
                    }}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      authMode === 'login'
                        ? 'bg-[#F36F00] text-white shadow-xs'
                        : 'text-slate-600 hover:text-[#1E293B]'
                    }`}
                  >
                    Đăng nhập Ứng viên
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError(null);
                      setConfirmPasswordError(null);
                    }}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      authMode === 'register'
                        ? 'bg-[#F36F00] text-white shadow-xs'
                        : 'text-slate-600 hover:text-[#1E293B]'
                    }`}
                  >
                    Đăng ký Ứng viên mới
                  </button>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">
                    {authMode === 'login'
                      ? 'Đăng nhập tài khoản Ứng viên'
                      : 'Đăng ký tài khoản Ứng viên mới'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {authMode === 'login'
                      ? 'Mật khẩu mặc định của các tài khoản trải nghiệm là: 123456'
                      : 'Tạo tài khoản mới để bắt đầu điền đơn đăng ký Cộng tác viên Câu lạc bộ Thương mại C-RES.'}
                  </p>
                </div>

                {authError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {authMode === 'register' && (
                    <div>
                      <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Họ và tên sinh viên:
                      </label>
                      <input
                        id="auth-name"
                        type="text"
                        required
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email sinh viên:
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="ten@due.udn.vn"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                    />
                  </div>

                  <div>
                    <label htmlFor="auth-pass" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Mật khẩu:
                    </label>
                    <input
                      id="auth-pass"
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => {
                        const nextPass = e.target.value;
                        setAuthPassword(nextPass);
                        if (authMode === 'register' && authConfirmPassword) {
                          setConfirmPasswordError(
                            nextPass !== authConfirmPassword
                              ? 'Mật khẩu xác nhận không khớp với mật khẩu đã nhập.'
                              : null
                          );
                        }
                      }}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                    />
                  </div>

                  {authMode === 'register' && (
                    <div>
                      <label htmlFor="auth-confirm-pass" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Xác nhận lại mật khẩu:
                      </label>
                      <input
                        id="auth-confirm-pass"
                        type="password"
                        required
                        value={authConfirmPassword}
                        onChange={(e) => {
                          const nextConfirm = e.target.value;
                          setAuthConfirmPassword(nextConfirm);
                          setConfirmPasswordError(
                            nextConfirm && nextConfirm !== authPassword
                              ? 'Mật khẩu xác nhận không khớp với mật khẩu đã nhập.'
                              : null
                          );
                        }}
                        placeholder="Nhập lại mật khẩu..."
                        aria-invalid={Boolean(confirmPasswordError)}
                        className={`w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                          confirmPasswordError
                            ? 'border-red-500 focus:ring-red-500 bg-red-50/30'
                            : 'border-slate-300 focus:ring-[#F36F00]'
                        }`}
                      />
                      {confirmPasswordError && (
                        <p className="text-xs font-semibold text-red-600 mt-1.5" role="alert">
                          {confirmPasswordError}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 text-sm font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors shadow-xs"
                  >
                    {authMode === 'login' ? 'Đăng nhập' : 'Đăng ký & Điền đơn ứng tuyển'}
                  </button>
                </form>
              </div>

              {/* Separate Collapsible Toggle for Internal Club Members (BNS, BCN, Admin) */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowInternalClubLogin((prev) => !prev)}
                  aria-expanded={showInternalClubLogin}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-[#1E293B] hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#F36F00]" />
                    <span>Dành cho Ban tổ chức / Nội bộ CLB (BNS, BCN)</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      showInternalClubLogin ? 'rotate-180 text-[#F36F00]' : ''
                    }`}
                  />
                </button>

                {showInternalClubLogin && (
                  <div className="mt-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                    <div className="text-[11px] font-medium text-slate-500">
                      Chọn phân hệ quản lý nội bộ Câu lạc bộ Thương mại C-RES:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleDemoSwitch({ role: 'hr' }, 'hr')}
                        className="p-2.5 text-left rounded-lg bg-white hover:border-[#F36F00] border border-slate-200 transition-all"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 shrink-0 text-[#F36F00]" />
                            <span>Ban Nhân sự (BNS)</span>
                          </div>
                          <UserRoleBadge role="hr" size="sm" />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">hr@cres.due.udn.vn</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDemoSwitch({ role: 'board' }, 'board')}
                        className="p-2.5 text-left rounded-lg bg-white hover:border-[#F36F00] border border-slate-200 transition-all"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 shrink-0 text-[#F36F00]" />
                            <span>Ban Chủ nhiệm (BCN)</span>
                          </div>
                          <UserRoleBadge role="board" size="sm" />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">bcn@cres.due.udn.vn</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDemoSwitch({ role: 'admin' }, 'dashboard')}
                        className="p-2.5 text-left rounded-lg bg-white hover:border-[#F36F00] border border-slate-200 transition-all"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                            <LayoutDashboard className="w-3.5 h-3.5 shrink-0 text-[#F36F00]" />
                            <span>Tổng quan đợt tuyển</span>
                          </div>
                          <UserRoleBadge role="admin" size="sm" />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Thống kê & Tiến độ</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDemoSwitch({ role: 'admin' }, 'admin')}
                        className="p-2.5 text-left rounded-lg bg-white hover:border-[#F36F00] border border-slate-200 transition-all"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                            <Settings className="w-3.5 h-3.5 shrink-0 text-[#F36F00]" />
                            <span>Cài đặt đợt tuyển</span>
                          </div>
                          <UserRoleBadge role="admin" size="sm" />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Chỉ tiêu 3 Ban & Tiêu chí</div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATED SHELL (NEUTRAL LIGHT #F8FAFC + WHITE HEADER + C-RES ACCENT)
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col leading-relaxed">
      {/* Main White Header with Official C-RES Logo */}
      <header className="flex items-center justify-between gap-4 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Zone 1: Official C-RES Logo + Brand Title */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <img
            src={CRES_LOGO_PATH}
            alt="Logo Câu lạc bộ Thương mại C-RES"
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-[#1E293B] leading-tight">
              Câu lạc bộ C-RES
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Đại học Kinh tế - Đại học Đà Nẵng
            </span>
          </div>
        </div>

        {/* Zone 2: User Identity with Role Badge, Facebook Link, Notifications & Logout */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 text-xs">
          <UserAccountInfo
            fullName={user.full_name}
            email={user.email}
            role={user.role}
          />
          <a
            href={CRES_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Trang Facebook Câu lạc bộ Thương mại C-RES"
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-[#F36F00] text-[#1E293B] font-semibold transition-colors"
          >
            <FacebookIcon className="w-4 h-4 text-[#1877F2]" />
            <span>Facebook C-RES</span>
          </a>
          <button
            type="button"
            onClick={handleOpenNotifDrawer}
            aria-label="Mở hộp thư thông báo"
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:border-[#F36F00] text-[#1E293B] font-semibold transition-colors"
          >
            <Bell className="w-4 h-4 text-[#F36F00]" />
            <span className="hidden sm:inline">Hộp thư</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Đăng xuất hoặc đổi tài khoản"
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700 text-slate-600 font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Đổi tài khoản</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {round && activeView === 'candidate' && (
          <CandidatePortal
            user={user}
            round={round}
            departments={departments}
            systemNow={systemNow}
            onRefreshGlobal={fetchRoundAndDemoAccounts}
          />
        )}

        {round && activeView === 'hr' && (
          <HrPortal
            round={round}
            departments={departments}
            systemNow={systemNow}
            onRefreshGlobal={fetchRoundAndDemoAccounts}
          />
        )}

        {round && activeView === 'board' && (
          <BoardPortal onRefreshGlobal={fetchRoundAndDemoAccounts} />
        )}

        {round && (activeView === 'dashboard' || activeView === 'admin') && (
          <DashboardAndAdmin
            mode={activeView === 'admin' ? 'admin' : 'dashboard'}
            onSelectMode={(m) => {
              setActiveView(m);
              localStorage.setItem('cres_active_view', m);
            }}
            onRefreshGlobal={fetchRoundAndDemoAccounts}
          />
        )}
      </main>

      {/* Crisp White Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={CRES_LOGO_PATH}
              alt="Logo Câu lạc bộ Thương mại C-RES"
              className="h-7 w-auto object-contain"
            />
            <span className="font-semibold text-[#1E293B]">
              Câu lạc bộ Thương mại C-RES — Đại học Kinh tế - Đại học Đà Nẵng
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={CRES_FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-[#F36F00] transition-colors"
            >
              <FacebookIcon className="w-4 h-4 text-[#1877F2]" />
              <span>Facebook Câu lạc bộ Thương mại C-RES</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Notification Bell Drawer */}
      {showNotifDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-label="Hộp thư thông báo"
        >
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-xl border-l border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2 font-bold text-sm text-[#1E293B]">
                <Bell className="w-4 h-4 text-[#F36F00]" />
                <span>Hộp thư thông báo ({notifications.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifDrawer(false)}
                aria-label="Đóng thông báo"
                className="p-1 text-slate-500 hover:text-[#1E293B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAFC]">
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">Hiện chưa có thông báo mới nào.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                    <div className="font-bold text-[#1E293B] text-sm leading-snug">{n.subject}</div>
                    <div className="text-[11px] text-[#F36F00] font-medium tabular-nums">
                      Gửi tới {n.to_email} · {new Date(n.created_at).toLocaleString('vi-VN')}
                    </div>
                    <p className="text-slate-600 whitespace-pre-line pt-1 leading-relaxed">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
