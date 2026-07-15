import { useState, type ReactNode } from 'react';
import { Menu, Shield, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'HOME' },
  { to: '/lore', label: 'LORE' },
  { to: '/enlist', label: 'ENLIST' },
  { to: '/personnel', label: 'PERSONNEL' },
  { to: '/command', label: 'COMMAND' },
  { to: '/battles', label: 'BATTLES' },
  { to: '/schedule', label: 'SCHEDULE' },
  { to: '/medals', label: 'MEDALS' }
];

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-navy text-silver">
      <header className="border-b border-slateBlue/60 bg-[#0d121b]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-silver/40 bg-slateBlue/80 shadow-[0_0_18px_rgba(232,236,242,0.25)]">
              <Shield className="h-6 w-6 text-silver" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Grand Andouran Battery</div>
              <div className="text-sm font-semibold uppercase tracking-[0.3em] text-silver">Vaspirian Legion</div>
            </div>
          </NavLink>
          <button className="rounded border border-slateBlue/60 p-2 md:hidden" onClick={() => setMobileOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </button>
          <nav className="hidden items-center gap-5 md:flex">
            {navItems.map((item) => (
              <NavLink key={item.to} className={({ isActive }) => `text-[11px] font-semibold uppercase tracking-[0.3em] ${isActive ? 'text-silver' : 'text-slate-400'}`} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        {mobileOpen && (
          <div className="border-t border-slateBlue/60 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-3">
              {navItems.map((item) => (
                <NavLink key={item.to} className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300" to={item.to} onClick={() => setMobileOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
