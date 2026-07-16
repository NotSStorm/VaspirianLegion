import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Menu, Shield, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { getAuthenticatedState } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Role } from '../types';

const navItems = [
  { to: '/', label: 'HOME' },
  { to: '/lore', label: 'LORE' },
  { to: '/enlist', label: 'ENLIST' },
  { to: '/personnel', label: 'PERSONNEL' },
  { to: '/command', label: 'COMMAND' },
  { to: '/battles', label: 'BATTLES' },
  { to: '/schedule', label: 'SCHEDULE' },
  { to: '/medals', label: 'MEDALS' },
  { to: '/leaderboard', label: 'LEADERBOARD' },
  { to: '/rally-tracker', label: 'RALLY TRACKER' }
];

type HeaderUser = {
  discordUsername: string;
  robloxId: string | null;
  robloxUsername: string | null;
  role: Role;
};

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerUser, setHeaderUser] = useState<HeaderUser | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const roleLabel = useMemo(() => {
    if (!headerUser) return null;
    return headerUser.role === 'admin' || headerUser.role === 'officer' ? 'Admin' : 'Member';
  }, [headerUser]);

  const allNavItems = useMemo(() => {
    if (headerUser?.role === 'admin' || headerUser?.role === 'officer') {
      return [...navItems, { to: '/admin', label: 'ADMIN' }];
    }
    return navItems;
  }, [headerUser]);

  useEffect(() => {
    let active = true;

    const loadHeaderUser = async () => {
      const { session, profile } = await getAuthenticatedState();
      if (!active || !session?.user || !profile) {
        setHeaderUser(null);
        setAvatarUrl(null);
        return;
      }

      setHeaderUser({
        discordUsername: profile.discord_username || session.user.email || 'signed-in-user',
        robloxId: profile.roblox_id || null,
        robloxUsername: profile.roblox_username || null,
        role: profile.role
      });
    };

    void loadHeaderUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void loadHeaderUser();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadAvatar = async () => {
      if (!headerUser?.robloxId && !headerUser?.robloxUsername) {
        setAvatarUrl(null);
        return;
      }

      try {
        setAvatarLoading(true);
        const response = await fetch('/api/roblox/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ robloxId: headerUser.robloxId, robloxUsername: headerUser.robloxUsername })
        });
        if (!response.ok) {
          setAvatarUrl(null);
          return;
        }

        const payload = await response.json().catch(() => ({}));
        if (!active || !payload?.imageUrl) {
          setAvatarUrl(null);
          return;
        }

        setAvatarUrl(String(payload.imageUrl));
      } catch {
        setAvatarUrl(null);
      } finally {
        if (active) {
          setAvatarLoading(false);
        }
      }
    };

    void loadAvatar();

    return () => {
      active = false;
    };
  }, [headerUser]);

  return (
    <div className="min-h-screen bg-navy text-silver">
      <header className="border-b border-slateBlue/60 bg-[#0d121b]/90 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-10 xl:px-14">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-silver/40 bg-slateBlue/80 shadow-[0_0_18px_rgba(232,236,242,0.25)]">
              <Shield className="h-6 w-6 text-silver" />
            </div>
            <div className="leading-tight">
              {headerUser?.discordUsername && (
                <div className="mb-1 text-[10px] uppercase tracking-[0.35em] text-slate-400">{headerUser.discordUsername}</div>
              )}
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Grand Andouran Battery</div>
              <div className="text-xl font-semibold uppercase tracking-[0.2em] text-silver">Vaspirian Legion</div>
            </div>
          </NavLink>
          <button className="rounded border border-slateBlue/60 p-2 md:hidden" onClick={() => setMobileOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-6 md:flex">
            <nav className="hidden items-center gap-5 lg:flex">
              {allNavItems.map((item) => (
                <NavLink key={item.to} className={({ isActive }) => `text-[11px] font-semibold uppercase tracking-[0.3em] ${isActive ? 'text-silver' : 'text-slate-400'}`} to={item.to}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {headerUser && (
              <NavLink to="/profile" className="flex items-center gap-3 rounded border border-slateBlue/60 bg-[#141a24] px-3 py-2 transition hover:border-silver/40 hover:bg-[#18202c]">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-slateBlue/60 bg-[#0d121b]">
                  {avatarLoading ? (
                    <div className="h-full w-full animate-pulse bg-slateBlue/30" />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="Roblox avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">N/A</div>
                  )}
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-silver">{roleLabel}</div>
                  <div className="max-w-[160px] truncate text-xs text-slate-300">{headerUser.robloxUsername || (headerUser.robloxId ? 'Roblox Linked' : 'Roblox Pending')}</div>
                </div>
              </NavLink>
            )}
          </div>
          <nav className="hidden items-center gap-5 md:flex lg:hidden">
            {allNavItems.map((item) => (
              <NavLink key={item.to} className={({ isActive }) => `text-[11px] font-semibold uppercase tracking-[0.3em] ${isActive ? 'text-silver' : 'text-slate-400'}`} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        {mobileOpen && (
          <div className="border-t border-slateBlue/60 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-3">
              {allNavItems.map((item) => (
                <NavLink key={item.to} className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300" to={item.to} onClick={() => setMobileOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="w-full px-4 py-8 sm:px-6 lg:px-10 xl:px-14">
        <div className="mb-8 rounded border border-slateBlue/70 bg-[#141a24] p-3 text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-silver" />
            <span className="uppercase tracking-[0.3em]">Site is a work in progress</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
