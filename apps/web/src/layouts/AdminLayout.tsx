import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Home, LayoutDashboard, Users, BookOpen, BarChart3, Megaphone } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { FieldSizeContext } from '@/components/ui/fieldSize';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The five admin destinations, dashboard first. `end` only matters for the
 * dashboard link below — every other tab is already its own exact path.
 * Bottom-positioned and styled with `.tabbar`/`.tab` — the same classes
 * `TabBar` uses (`shell.css`, recomposed for desktop in `stage.css`) — so
 * admin reads as the same product's navigation, not a second one. A separate
 * component rather than reusing `TabBar` itself: that component's doc
 * comment locks it to the participant side's five destinations (spec §4 rule
 * 3), and admin's five are a different set going to different places.
 */
const TABS: Tab[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/participants', label: 'Participants', icon: Users },
  { to: '/admin/quest', label: 'Quest', icon: BookOpen },
  { to: '/admin/results', label: 'Results', icon: BarChart3 },
  { to: '/admin/broadcast', label: 'Broadcast', icon: Megaphone }
];

/**
 * The admin shell — plan Phase 4: "the same product seen from behind, not a
 * different one." Same ground, same paper, same Archivo, and now the same
 * bottom navigation as the participant side too — a top bar carries only the
 * wordmark and the way out.
 *
 * Mounted as `RequireAdmin`'s child in `router.tsx`, so by the time this
 * renders the client-side check has already passed — see that guard's own
 * comment for why passing it proves nothing. Every query a page below this
 * fires re-checks the role server-side; a stale "yes" here just means the
 * next request comes back `403 forbidden`, rendered as `ForbiddenState`.
 *
 * No `<Toast />` or atmosphere layer here — both already come from
 * `AppLayout`, which wraps this whole route tree same as it wraps the
 * participant screens (see `router.tsx`). This only adds the nav and the
 * content well; the shell around it is the one shell.
 */
export function AdminLayout() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
      <AdminNav />
      <main className="flex flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
      <AdminTabBar />
    </div>
  );
}

function AdminNav() {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-[color:var(--rule)] px-4 pt-[calc(1rem+var(--safe-t))] pb-4 sm:px-8">
      <Link
        to="/"
        aria-label="Back to the stage"
        className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-taupe hover:text-paper-dim"
      >
        <Home className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </Link>
      <div className="flex flex-col items-end leading-tight">
        <span className="type-display text-lg text-paper">BookQuest</span>
        <span className="type-label">Admin</span>
      </div>
    </header>
  );
}

function AdminTabBar() {
  return (
    <nav className="tabbar" aria-label="Admin sections">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/admin'}
          className={({ isActive }) => (isActive ? 'tab is-on' : 'tab')}
        >
          <Icon className="tab__icon" aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

interface AdminScreenProps {
  children: ReactNode;
  className?: string;
}

/**
 * The content well every admin page renders into — `Screen`'s admin
 * counterpart, not a reuse of `Screen` itself: `Screen` reserves the tab
 * bar's clearance under its own `.screen` class, sized for the participant
 * layout's paddings. `.admin-screen` (`shell.css`) reserves the same
 * clearance for ≥900px, when `AdminTabBar` recomposes into the floating pill
 * same as `TabBar` does — below that width `.tabbar` is sticky, not fixed,
 * so it already occupies its own row in the flow and nothing here needs to
 * reserve space for it.
 */
export function AdminScreen({ children, className = '' }: AdminScreenProps) {
  return (
    <FieldSizeContext.Provider value="compact">
      <div className={`admin-screen flex flex-1 flex-col gap-6 ${className}`}>{children}</div>
    </FieldSizeContext.Provider>
  );
}
