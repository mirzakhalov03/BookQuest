import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

interface Tab {
  to: string;
  label: string;
  icon: ReactNode;
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
  {
    to: '/admin',
    label: 'Dashboard',
    icon: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </>
    )
  },
  {
    to: '/admin/participants',
    label: 'Participants',
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
        <circle cx="18" cy="9" r="2.2" />
        <path d="M15.5 20c.2-2.6 1.8-4.4 4.5-4.7" />
      </>
    )
  },
  {
    to: '/admin/quest',
    label: 'Quest',
    icon: (
      <>
        <path d="M6 4h12v16H6z" />
        <path d="M9 4v16" />
      </>
    )
  },
  {
    to: '/admin/results',
    label: 'Results',
    icon: <path d="M5 20V14M12 20V6M19 20v-9" />
  },
  {
    to: '/admin/broadcast',
    label: 'Broadcast',
    icon: (
      <>
        <path d="M4 10v4h3l7 4V6l-7 4H4z" />
        <path d="M16.5 9a4 4 0 0 1 0 6" />
        <path d="M19 7a7 7 0 0 1 0 10" />
      </>
    )
  }
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
    <header className="flex items-baseline gap-3 border-b border-[color:var(--rule)] px-4 pt-[calc(1rem+var(--safe-b))] pb-4 sm:px-8">
      <Link to="/" className="type-label text-taupe hover:text-paper-dim">
        ← Back to the stage
      </Link>
      <span className="type-display text-lg text-paper">BookQuest</span>
      <span className="type-label">Admin</span>
    </header>
  );
}

function AdminTabBar() {
  return (
    <nav className="tabbar" aria-label="Admin sections">
      {TABS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/admin'}
          className={({ isActive }) => (isActive ? 'tab is-on' : 'tab')}
        >
          <svg className="tab__icon" viewBox="0 0 24 24" aria-hidden="true">
            {icon}
          </svg>
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
  return <div className={`admin-screen flex flex-1 flex-col gap-6 ${className}`}>{children}</div>;
}
