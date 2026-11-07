import React from 'react';
import { UserCircle2, Users, Award, Shield } from 'lucide-react';
import type { UserRole } from '../types';
import { ROLE_LABELS } from '../types';

export function getUserRoleLabel(role: UserRole | undefined | null): string {
  if (!role) return 'Chưa xác định';
  return ROLE_LABELS[role] || role;
}

export function UserRoleBadge({
  role,
  size = 'md',
  className = '',
}: {
  role: UserRole;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const label = getUserRoleLabel(role);

  const styleMap: Record<UserRole, { badge: string; icon: React.ReactNode }> = {
    candidate: {
      badge: 'bg-blue-50 text-blue-800 border-blue-200',
      icon: (
        <UserCircle2
          className={size === 'sm' ? 'w-3 h-3 text-blue-600 shrink-0' : 'w-3.5 h-3.5 text-blue-600 shrink-0'}
          aria-hidden="true"
        />
      ),
    },
    hr: {
      badge: 'bg-orange-50 text-[#C45800] border-orange-200',
      icon: (
        <Users
          className={size === 'sm' ? 'w-3 h-3 text-[#F36F00] shrink-0' : 'w-3.5 h-3.5 text-[#F36F00] shrink-0'}
          aria-hidden="true"
        />
      ),
    },
    board: {
      badge: 'bg-purple-50 text-purple-800 border-purple-200',
      icon: (
        <Award
          className={size === 'sm' ? 'w-3 h-3 text-purple-700 shrink-0' : 'w-3.5 h-3.5 text-purple-700 shrink-0'}
          aria-hidden="true"
        />
      ),
    },
    admin: {
      badge: 'bg-slate-100 text-slate-800 border-slate-300',
      icon: (
        <Shield
          className={size === 'sm' ? 'w-3 h-3 text-slate-700 shrink-0' : 'w-3.5 h-3.5 text-slate-700 shrink-0'}
          aria-hidden="true"
        />
      ),
    },
  };

  const current = styleMap[role] || styleMap.candidate;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-md border whitespace-nowrap shrink-0 ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${current.badge} ${className}`}
      title={`Vai trò tài khoản: ${label}`}
      aria-label={`Vai trò: ${label}`}
    >
      {current.icon}
      <span>{label}</span>
    </span>
  );
}

/**
 * Responsive user identity pill for top header or page card:
 * Displays user name, role badge, and email (when space permits).
 */
export function UserAccountInfo({
  fullName,
  email,
  role,
  className = '',
}: {
  fullName: string;
  email?: string;
  role: UserRole;
  className?: string;
}) {
  const roleLabel = getUserRoleLabel(role);

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs shadow-2xs ${className}`}
      title={`Tài khoản: ${fullName}${email ? ` (${email})` : ''} · Vai trò: ${roleLabel}`}
    >
      <div className="flex flex-col items-start min-w-0 leading-tight">
        <span className="font-bold text-[#1E293B] max-w-[110px] sm:max-w-[170px] md:max-w-[220px] truncate">
          {fullName}
        </span>
        {email && (
          <span className="text-[10px] text-slate-500 font-mono hidden md:inline max-w-[170px] md:max-w-[220px] truncate">
            {email}
          </span>
        )}
      </div>
      <UserRoleBadge role={role} size="sm" />
    </div>
  );
}
