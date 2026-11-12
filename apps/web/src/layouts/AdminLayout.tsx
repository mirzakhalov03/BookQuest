import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart3,
  Megaphone,
  MessageSquare,
  ListChecks,
  Ellipsis
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { FieldSizeContext } from '@/components/ui/fieldSize';
import { Sheet } from '@/components/ui/Sheet';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Daily destinations stay on the bar; the rest live behind "More" so five
 * slots fit a 360px phone without labels ellipsising. Styled with the same
 * `.tabbar`/`.tab` classes as the participant `TabBar`, but its own component:
 * that one is locked to the participant side's five destinations (spec §4 rule 3).
 */
const PRIMARY_TABS: Tab[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/participants', label: 'Participants', icon: Users },
  { to: '/admin/quest', label: 'Quest', icon: BookOpen },
  { to: '/admin/quizzes', label: 'Quizzes', icon: ListChecks }
];

const MORE_TABS: Tab[] = [
  { to: '/admin/results', label: 'Results', icon: BarChart3 },
  { to: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare }
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
      {/* The edge stretch (`useOverscroll`) moves this, never the tab bar below. */}
      <div className="stretch flex flex-1 flex-col">
        <AdminNav />
        <main className="flex flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
      <AdminTabBar />
    </div>
  );
}

function AdminNav() {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-[color:var(--rule)] px-4 pt-4 pb-4 sm:px-8">
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
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = MORE_TABS.some(({ to }) => pathname.startsWith(to));

  return (
    <>
      <nav className="tabbar" aria-label="Admin sections">
        {PRIMARY_TABS.map(({ to, label, icon: Icon }) => (
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
        <button
          type="button"
          className={inMore ? 'tab is-on' : 'tab'}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <Ellipsis className="tab__icon" aria-hidden="true" />
          {/* On a "More" page, name it — the bar alone wouldn't say where you are. */}
          <span>{MORE_TABS.find(({ to }) => pathname.startsWith(to))?.label ?? 'More'}</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {MORE_TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-3 rounded-box px-3 transition-colors ${
                    isActive ? 'bg-ash-hi text-ember' : 'text-paper-dim hover:bg-ash-hi'
                  }`
                }
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                <span className="font-medium">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
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
