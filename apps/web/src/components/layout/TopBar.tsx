import { NavLink } from 'react-router';
import { isInsideTelegram, openExternalLink } from '@/lib/telegram';
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
 * this is where Notifications actually surfaces instead: the one chrome
 * element already present on every screen.
 */
function NotificationsBell() {
  const notifications = useNotifications();
  const unreadCount = notifications.data?.filter((n) => !n.readAt).length ?? 0;

  return (
    <NavLink to="/notifications" aria-label="Notifications" className="relative">
      <span aria-hidden="true">🔔</span>
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
      Open on web <span aria-hidden="true">↗</span>
    </a>
  );
}
