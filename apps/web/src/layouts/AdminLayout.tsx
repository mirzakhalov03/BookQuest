import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';

interface Tab {
  to: string;
  label: string;
}

/**
 * The four admin destinations, dashboard first. `end` only matters for the
 * dashboard link below — every other tab is already its own exact path.
 */
const TABS: Tab[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/participants', label: 'Participants' },
  { to: '/admin/quest', label: 'Quest' },
  { to: '/admin/results', label: 'Results' },
  { to: '/admin/broadcast', label: 'Broadcast' }
];

/**
 * The admin shell — plan Phase 4: "the same product seen from behind, not a
 * different one." Same ground, same paper, same Archivo; the difference is
 * density and a top nav instead of a tab bar, because these four screens are
 * tables and forms, not a stage.
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
    </div>
  );
}

function AdminNav() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[color:var(--rule)] px-4 pt-[calc(1rem+var(--safe-b))] pb-4 sm:px-8">
      <div className="flex items-baseline gap-2">
        <span className="type-display text-lg text-paper">BookQuest</span>
        <span className="type-label">Admin</span>
      </div>

      <nav aria-label="Admin sections" className="-mx-1 flex gap-1 overflow-x-auto">
        {TABS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-[3px] px-3 py-2 text-sm transition-colors ${
                isActive ? 'text-ember' : 'text-taupe hover:text-paper-dim'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

interface AdminScreenProps {
  children: ReactNode;
  className?: string;
}

/**
 * The content well every admin page renders into — `Screen`'s admin
 * counterpart, not a reuse of `Screen` itself: `Screen`'s bottom padding
 * reserves room for the tab bar (`--tabbar-h`), and there is no tab bar
 * here. Same idea (consistent padding, a `className` escape hatch for a
 * page that wants a narrower measure), sized for a top nav instead.
 */
export function AdminScreen({ children, className = '' }: AdminScreenProps) {
  return <div className={`flex flex-1 flex-col gap-6 ${className}`}>{children}</div>;
}
