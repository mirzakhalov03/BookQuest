import { Bell, ArrowUpRight } from 'lucide-react';
import { NavLink } from 'react-router';
import { isInsideTelegram, openExternalLink } from '@/lib/telegram';
import { readToken } from '@/lib/auth/tokenStore';
import { useNotifications } from '@/features/notifications/api/useNotifications';

interface TopBarProps {
  /**
   * `quest.year`. Backend-owned (spec §11) — an admin can start the 2027
   * edition without a deploy, so this is never a literal. Optional because a
   * screen may paint its chrome before the quest query settles; the wordmark
   * reads fine on its own for that frame.
   */
  year?: number;
}

/** Where the Mini App sends people who want the real browser. */
const WEB_URL = import.meta.env.VITE_WEB_URL;

/**
 * The wordmark and the one link out. Styling is `.topbar` / `.wordmark` /
 * `.weblink` in `styles/stage.css`, ported from the prototype.
 */
export function TopBar({ year }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="wordmark">
        <span className="wordmark__name">BookQuest</span>
        {year !== undefined && <span className="wordmark__year">{year}</span>}
      </div>
      <div className="flex items-center gap-3">
        <NotificationsBell />
        <WebLink />
      </div>
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
  const notifications = useNotifications();
  const unreadCount = notifications.data?.filter((n) => !n.readAt).length ?? 0;

  // Nothing to show a visitor who has no session to fetch a feed for — same
  // gate `useNotifications` puts on the request itself.
  if (readToken() === null) return null;

  return (
    <NavLink to="/notifications" aria-label="Notifications" className="relative">
      <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-ember px-1 text-xs text-paper">
          {unreadCount}
        </span>
      )}
    </NavLink>
  );
}

/**
 * "Open on web" only means something inside Telegram, where the app is a sheet
 * over a chat and leaving it is a real action. On the web the app already *is*
 * the web, so the link would point at the page it is on — the honest version of
 * that link is no link at all, and the wordmark keeps the bar.
 *
 * It stays an ordinary anchor so it can be middle-clicked, copied and read by
 * assistive tech; the click handler only takes over when Telegram's own
 * `openLink` is there to open it outside the sheet.
 */
function WebLink() {
  if (!WEB_URL || !isInsideTelegram()) return null;

  return (
    <a
      className="weblink"
      href={WEB_URL}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (openExternalLink(WEB_URL)) event.preventDefault();
      }}
    >
      Open on web <ArrowUpRight className="inline h-4 w-4 align-[-2px]" aria-hidden="true" />
    </a>
  );
}
