import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  LogOut,
  UserCircle2,
  Users,
  Award,
  LayoutDashboard,
  X,
} from 'lucide-react';
import { apiRequest, getStoredToken, setStoredToken } from './api';
import type {
  User,
  UserRole,
  RecruitmentRound,
  Department,
  NotificationItem,
} from './types';
import { STATUS_LABELS } from './types';
import { CandidatePortal } from './components/CandidatePortal';
import { HrPortal } from './components/HrPortal';
import { BoardPortal } from './components/BoardPortal';
import { DashboardAndAdmin } from './components/DashboardAndAdmin';

const CRES_LOGO_PATH = '/assets/aistudio/C-RES_C__VI_N__1__e8c78418.png';

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

  // Demo accounts list for quick switching
  const [demoCandidates, setDemoCandidates] = useState<
    Array<User & { status: string; student_id: string }>
  >([]);

  // Auth Screen state (when logged out)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
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
    if (role === 'candidate') setActiveView('candidate');
    else if (role === 'hr') setActiveView('hr');
    else if (role === 'board') setActiveView('board');
    else setActiveView('dashboard');
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
            syncDefaultViewForRole(me.user.role);
            return;
          } catch {
            setStoredToken(null);
          }
        }
        const demoLogin = await apiRequest('/auth/demo', {
          method: 'POST',
          body: JSON.stringify({ role: 'admin' }),
        });
        setStoredToken(demoLogin.token);
        setUser(demoLogin.user);
        setActiveView('dashboard');
      } catch (err) {
        console.error('Bootstrap error:', err);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [fetchRoundAndDemoAccounts]);

  const handleDemoSwitch = async (target: { role?: UserRole; email?: string }, targetView?: typeof activeView) => {
    try {
      const res = await apiRequest('/auth/demo', {
        method: 'POST',
        body: JSON.stringify(target),
      });
      setStoredToken(res.token);
      setUser(res.user);
      if (targetView) {
        setActiveView(targetView);
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
      setAuthError(err instanceof Error ? err.message : 'Lỗi xác thực');
    }
  };

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
    setAuthEmail('');
    setAuthPassword('');
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 gap-3">
        <img
          src={CRES_LOGO_PATH}
          alt="Logo CLB C-res"
          className="h-16 w-auto object-contain"
        />
        <div className="text-sm font-semibold text-[#435B61]">
          Đang khởi tạo hệ thống C-res Recruit...
        </div>
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATION SCREEN (WHITE + C-RES LOGO PALETTE)
  // ============================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full mx-auto bg-white border-2 border-[#435B61]/20 rounded-2xl overflow-hidden shadow-sm">
          {/* 4-Color C-res Brand Strip */}
          <div className="grid grid-cols-4 h-2">
            <div className="bg-[#F36F00]" />
            <div className="bg-[#68A225]" />
            <div className="bg-[#31B5D8]" />
            <div className="bg-[#FDD000]" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Column: C-res Logo & Demo Quick Login on Crisp White */}
            <div className="lg:col-span-6 bg-white border-b lg:border-b-0 lg:border-r border-[#435B61]/15 p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={CRES_LOGO_PATH}
                    alt="Logo CLB C-res"
                    className="h-14 w-auto object-contain"
                  />
                  <div>
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#F36F00]">
                      ĐH Kinh tế – ĐH Đà Nẵng
                    </div>
                    <div className="text-sm font-bold text-[#435B61]">
                      Câu lạc bộ Nghiên cứu & Sự kiện C-res
                    </div>
                  </div>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[#26383C]">
                  C-res Recruit — Hệ thống Tuyển Cộng Tác Viên Tự Động Hóa
                </h1>
                <p className="text-xs text-[#435B61] leading-relaxed">
                  Số hóa quy trình TO-BE BPMN: Kiểm tra hồ sơ trên Sheet, Subprocess Bổ sung 2 ngày, Sơ loại theo ngưỡng X/Y, Tự đặt lịch phỏng vấn (Timer nhắc 1 ngày / gạch tên 2 ngày), Phỏng vấn song song AND-join và Phân ban có Gemini AI hỗ trợ.
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#435B61]/15">
                <div className="text-xs font-bold text-[#435B61] uppercase tracking-wider">
                  CHẾ ĐỘ DEMO — Đăng nhập nhanh 1 chạm theo 4 màu Logo:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleDemoSwitch({ role: 'candidate' }, 'candidate')}
                    className="p-3 text-left rounded-xl bg-white hover:bg-[#F36F00]/8 border-2 border-[#F36F00] transition-colors"
                  >
                    <div className="text-xs font-bold text-[#F36F00]">1. Ứng viên (Candidate)</div>
                    <div className="text-[11px] text-[#435B61] mt-0.5">ungvien@due.udn.vn</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoSwitch({ role: 'hr' }, 'hr')}
                    className="p-3 text-left rounded-xl bg-white hover:bg-[#68A225]/8 border-2 border-[#68A225] transition-colors"
                  >
                    <div className="text-xs font-bold text-[#53821D]">2. Ban Nhân sự (HR)</div>
                    <div className="text-[11px] text-[#435B61] mt-0.5">hr@cres.due.udn.vn</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoSwitch({ role: 'board' }, 'board')}
                    className="p-3 text-left rounded-xl bg-white hover:bg-[#31B5D8]/8 border-2 border-[#31B5D8] transition-colors"
                  >
                    <div className="text-xs font-bold text-[#1989A8]">3. Ban Chủ nhiệm (BCN)</div>
                    <div className="text-[11px] text-[#435B61] mt-0.5">bcn@cres.due.udn.vn</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoSwitch({ role: 'admin' }, 'dashboard')}
                    className="p-3 text-left rounded-xl bg-white hover:bg-[#FDD000]/15 border-2 border-[#E5BC00] transition-colors"
                  >
                    <div className="text-xs font-bold text-[#8A6D00]">4. Quản trị viên (Admin)</div>
                    <div className="text-[11px] text-[#435B61] mt-0.5">admin@cres.due.udn.vn</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Standard Login / Register Form */}
            <div className="lg:col-span-6 p-8 bg-white flex flex-col justify-center space-y-5">
              <div className="flex items-center gap-2 bg-[#F4F7F8] p-1 rounded-lg w-fit border border-[#435B61]/15">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    authMode === 'login'
                      ? 'bg-[#F36F00] text-white shadow-xs'
                      : 'text-[#435B61] hover:text-[#26383C]'
                  }`}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError(null);
                  }}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    authMode === 'register'
                      ? 'bg-[#F36F00] text-white shadow-xs'
                      : 'text-[#435B61] hover:text-[#26383C]'
                  }`}
                >
                  Đăng ký tài khoản Ứng viên mới
                </button>
              </div>

              <div>
                <h2 className="text-lg font-bold text-[#26383C]">
                  {authMode === 'login' ? 'Đăng nhập vào C-res Recruit' : 'Tạo tài khoản Ứng viên CTV mới'}
                </h2>
                <p className="text-xs text-[#435B61] mt-0.5">
                  {authMode === 'login'
                    ? 'Mật khẩu mặc định của mọi tài khoản demo là: 123456'
                    : 'Đăng ký tài khoản ứng viên mới để trải nghiệm điền Form ứng tuyển từ bước đầu tiên.'}
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
                    <label htmlFor="auth-name" className="block text-xs font-semibold text-[#435B61] mb-1">
                      Họ và tên sinh viên:
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full px-3.5 py-2 text-sm border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold text-[#435B61] mb-1">
                    Email:
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="ten@due.udn.vn"
                    className="w-full px-3.5 py-2 text-sm border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                  />
                </div>

                <div>
                  <label htmlFor="auth-pass" className="block text-xs font-semibold text-[#435B61] mb-1">
                    Mật khẩu:
                  </label>
                  <input
                    id="auth-pass"
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2 text-sm border border-[#435B61]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 text-sm font-bold text-white bg-[#F36F00] hover:bg-[#D96200] rounded-lg transition-colors"
                >
                  {authMode === 'login' ? 'Đăng nhập' : 'Đăng ký & Bắt đầu điền hồ sơ'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATED SHELL (WHITE + C-RES LOGO PALETTE)
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#FAFDFD] flex flex-col">
      {/* Signature 4-Color C-res Ribbon (Orange · Green · Cyan · Yellow) */}
      <div className="grid grid-cols-4 h-1.5 sticky top-0 z-40">
        <div className="bg-[#F36F00]" />
        <div className="bg-[#68A225]" />
        <div className="bg-[#31B5D8]" />
        <div className="bg-[#FDD000]" />
      </div>

      {/* Main White Header with Official C-res Logo */}
      <header className="flex items-center justify-between gap-6 px-6 py-3 bg-white border-b border-[#435B61]/15 sticky top-1.5 z-30 shadow-2xs">
        {/* Zone 1: Official C-res Logo + Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            syncDefaultViewForRole(user.role);
          }}
          className="flex items-center gap-3 whitespace-nowrap shrink-0 group"
        >
          <img
            src={CRES_LOGO_PATH}
            alt="Logo CLB C-res"
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-[#26383C] group-hover:text-[#F36F00] transition-colors leading-tight">
              C-res Recruit
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#435B61]">
              CLB C-res · ĐH Kinh tế ĐHĐN
            </span>
          </div>
        </a>

        {/* Zone 2: Navigation Links using C-res Logo Accents */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#435B61]">
          {(user.role === 'admin' || user.role === 'hr' || user.role === 'board') && (
            <a
              href="#dashboard"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('dashboard');
              }}
              className={`hover:text-[#F36F00] transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeView === 'dashboard'
                  ? 'text-[#F36F00] font-bold border-b-2 border-[#F36F00]'
                  : ''
              }`}
            >
              Dashboard
            </a>
          )}
          {(user.role === 'admin' || user.role === 'hr') && (
            <a
              href="#hr"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('hr');
              }}
              className={`hover:text-[#68A225] transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeView === 'hr'
                  ? 'text-[#588A1E] font-bold border-b-2 border-[#68A225]'
                  : ''
              }`}
            >
              Ban Nhân sự
            </a>
          )}
          {(user.role === 'admin' || user.role === 'board') && (
            <a
              href="#board"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('board');
              }}
              className={`hover:text-[#31B5D8] transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeView === 'board'
                  ? 'text-[#188BA8] font-bold border-b-2 border-[#31B5D8]'
                  : ''
              }`}
            >
              Ban Chủ nhiệm
            </a>
          )}
          <a
            href="#candidate"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('candidate');
            }}
            className={`hover:text-[#F36F00] transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeView === 'candidate'
                ? 'text-[#F36F00] font-bold border-b-2 border-[#F36F00]'
                : ''
            }`}
          >
            Hồ sơ Ứng viên
          </a>
          {(user.role === 'admin' || user.role === 'hr' || user.role === 'board') && (
            <a
              href="#admin"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('admin');
              }}
              className={`hover:text-[#B38E00] transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeView === 'admin'
                  ? 'text-[#9E7D00] font-bold border-b-2 border-[#FDD000]'
                  : ''
              }`}
            >
              Cài đặt & Timer
            </a>
          )}
        </nav>

        {/* Zone 3: Primary Action in C-res Orange */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveView('candidate')}
            className="px-4 py-2 text-xs font-bold text-white bg-[#F36F00] rounded-lg hover:bg-[#D96200] transition-colors whitespace-nowrap shrink-0 shadow-2xs"
          >
            Cổng Ứng viên
          </button>
        </div>
      </header>

      {/* White & C-res Palette Demo Role Switcher Toolbar */}
      <div className="bg-white text-[#26383C] px-6 py-2.5 border-b border-[#435B61]/15">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[#435B61] font-bold uppercase whitespace-nowrap flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#F36F00]" />
              Chế độ Demo Vai trò:
            </span>
            <button
              type="button"
              onClick={() => handleDemoSwitch({ role: 'admin' }, 'dashboard')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap border ${
                user.role === 'admin' && (activeView === 'dashboard' || activeView === 'admin')
                  ? 'bg-[#F36F00] text-white border-[#F36F00]'
                  : 'bg-white text-[#435B61] border-[#435B61]/25 hover:border-[#F36F00] hover:text-[#F36F00]'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard & Admin
            </button>
            <button
              type="button"
              onClick={() => handleDemoSwitch({ role: 'hr' }, 'hr')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap border ${
                user.role === 'hr' || activeView === 'hr'
                  ? 'bg-[#68A225] text-white border-[#68A225]'
                  : 'bg-white text-[#435B61] border-[#435B61]/25 hover:border-[#68A225] hover:text-[#588A1E]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Ban Nhân sự (HR)
            </button>
            <button
              type="button"
              onClick={() => handleDemoSwitch({ role: 'board' }, 'board')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap border ${
                user.role === 'board' || activeView === 'board'
                  ? 'bg-[#31B5D8] text-white border-[#31B5D8]'
                  : 'bg-white text-[#435B61] border-[#435B61]/25 hover:border-[#31B5D8] hover:text-[#188BA8]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Ban Chủ nhiệm (BCN)
            </button>
            <button
              type="button"
              onClick={() => handleDemoSwitch({ role: 'candidate' }, 'candidate')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap border ${
                user.role === 'candidate' && activeView === 'candidate'
                  ? 'bg-[#FDD000] text-[#26383C] border-[#E5BC00]'
                  : 'bg-white text-[#435B61] border-[#435B61]/25 hover:border-[#E5BC00] hover:text-[#8A6D00]'
              }`}
            >
              <UserCircle2 className="w-3.5 h-3.5" />
              Ứng viên (Đặt lịch/Bổ sung)
            </button>

            <select
              aria-label="Chuyển nhanh sang hồ sơ ứng viên mẫu"
              value={user.role === 'candidate' ? user.email : ''}
              onChange={(e) => {
                if (e.target.value === '__NEW__') {
                  handleLogout();
                  setAuthMode('register');
                } else if (e.target.value) {
                  handleDemoSwitch({ email: e.target.value }, 'candidate');
                }
              }}
              className="px-2.5 py-1.5 text-xs font-medium bg-white text-[#26383C] border border-[#435B61]/30 rounded-lg max-w-[260px] focus:outline-none focus:ring-2 focus:ring-[#F36F00]"
            >
              <option value="">-- Đổi sang Ứng viên cụ thể (42 case) --</option>
              <option value="__NEW__">+ Đăng ký Ứng viên mới (Form trống)</option>
              {demoCandidates.map((c) => (
                <option key={c.id} value={c.email}>
                  {c.full_name} — [{STATUS_LABELS[c.status as keyof typeof STATUS_LABELS] || c.status}]
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-[#435B61] hidden sm:inline">
              Đang đăng nhập: <strong className="text-[#26383C]">{user.full_name}</strong>{' '}
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#31B5D8]/15 text-[#146D85] font-bold">
                {user.role.toUpperCase()}
              </span>
            </span>
            <button
              type="button"
              onClick={handleOpenNotifDrawer}
              aria-label="Mở hộp thư thông báo"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#435B61]/25 hover:border-[#F36F00] text-[#26383C] font-semibold transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-[#F36F00]" />
              <span>Thông báo</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Đăng xuất hoặc đổi tài khoản"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#435B61]/25 hover:bg-red-50 hover:border-red-300 hover:text-red-700 text-[#435B61] font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>

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
            onRefreshGlobal={fetchRoundAndDemoAccounts}
          />
        )}
      </main>

      {/* Crisp White Footer with Logo */}
      <footer className="bg-white border-t border-[#435B61]/15 py-4 px-6 text-xs text-[#435B61]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={CRES_LOGO_PATH}
              alt="Logo CLB C-res"
              className="h-7 w-auto object-contain"
            />
            <span className="font-medium text-[#26383C]">
              C-res Recruit — Hệ thống Tuyển Cộng Tác Viên CLB C-res (Trường Đại học Kinh tế – Đại học Đà Nẵng)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Trường Đại học Kinh tế – Đại học Đà Nẵng (DUE)</span>
          </div>
        </div>
      </footer>

      {/* Notification Bell Drawer */}
      {showNotifDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#26383C]/40"
          role="dialog"
          aria-modal="true"
          aria-label="Danh sách thông báo"
        >
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-xl border-l border-[#435B61]/20">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#435B61]/15 bg-white">
              <div className="flex items-center gap-2 font-bold text-sm text-[#26383C]">
                <Bell className="w-4 h-4 text-[#F36F00]" />
                <span>Thông báo hệ thống ({notifications.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifDrawer(false)}
                aria-label="Đóng thông báo"
                className="p-1 text-[#435B61] hover:text-[#26383C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFDFD]">
              {notifications.length === 0 ? (
                <p className="text-xs text-[#435B61] text-center py-8">Chưa có thông báo nào.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-3.5 rounded-lg bg-white border border-[#435B61]/15 text-xs space-y-1 shadow-2xs">
                    <div className="font-bold text-[#26383C]">{n.subject}</div>
                    <div className="text-[11px] font-mono text-[#188BA8] tabular-nums">
                       tới {n.to_email} · {new Date(n.created_at).toLocaleString('vi-VN')}
                    </div>
                    <p className="text-[#435B61] whitespace-pre-line pt-1">{n.body}</p>
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
