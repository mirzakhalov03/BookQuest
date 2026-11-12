import { Bell } from 'lucide-react';
import { NavLink } from 'react-router';
import { readToken } from '@/lib/auth/tokenStore';
import { useNotifications } from '@/features/notifications/api/useNotifications';
import { useT } from '@/i18n';

interface TopBarProps {
  /**
   * `quest.year`. Backend-owned (spec §11) — an admin can start the 2027
   * edition without a deploy, so this is never a literal. Optional because a
   * screen may paint its chrome before the quest query settles; the wordmark
   * reads fine on its own for that frame.
   */
  year?: number;
}

/**
 * The wordmark and the notifications bell. Styling is `.topbar` / `.wordmark`
 * in `styles/stage.css`, ported from the prototype.
 */
export function TopBar({ year }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="wordmark">
        <span className="wordmark__name">BookQuest</span>
        {year !== undefined && <span className="wordmark__year">{year}</span>}
      </div>
      <NotificationsBell />
    </header>
  );
}

/**
 * The tab bar is design-locked to the prototype's five destinations (spec) —
 * this is where Notifications actually surfaces instead. `TopBar` is
 * currently mounted by `HomePage` only (all three of its branches, so this
 * reaches someone between editions too, not just the success state) — a
 * placement judgment call, not a spec requirement; see that plan's own note.
 */
function NotificationsBell() {
  const t = useT();
  const notifications = useNotifications();
  const unreadCount = notifications.data?.unreadCount ?? 0;

  // Nothing to show a visitor who has no session to fetch a feed for — same
  // gate `useNotifications` puts on the request itself.
  if (readToken() === null) return null;

  return (
    <NavLink to="/notifications" aria-label={t.nav.notifications} className="relative">
      <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-ember px-1 text-xs text-paper">
          {unreadCount}
        </span>
      )}
    </NavLink>
  );
}
