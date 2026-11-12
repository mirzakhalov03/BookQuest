import { useState } from 'react';
import { Award, CheckCheck, ChevronRight, Megaphone } from 'lucide-react';
import type { Notification } from '@bookquest/shared';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { formatLongDate, formatTimeAgo } from '@/lib/format';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useNotifications } from './api/useNotifications';
import { useMarkAllNotificationsRead, useMarkNotificationRead } from './api/useMarkNotificationRead';

const KIND = {
  broadcast: { icon: Megaphone, label: 'Announcement' },
  system: { icon: Award, label: 'Update' }
} as const;

// Broadcasts all carry the app name as their title, so the kind says more.
const headingOf = (n: Notification) => (n.kind === 'broadcast' ? KIND.broadcast.label : n.title);

export function NotificationsPage() {
  usePullToRefresh();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [openId, setOpenId] = useState<string | null>(null);

  if (notifications.isPending) return <LoadingState label="Reading notifications…" />;
  if (notifications.error) {
    return <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />;
  }

  const { items, unreadCount } = notifications.data;
  const open = items.find((item) => item.id === openId) ?? null;

  function openMessage(notification: Notification) {
    setOpenId(notification.id);
    if (!notification.readAt) markRead.mutate(notification.id);
  }

  return (
    <Screen className="gap-5">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="type-display m-0 text-2xl text-paper">Notifications</h1>
          {items.length > 0 && (
            <p className="m-0 text-sm text-taupe">
              {unreadCount > 0 ? `${unreadCount} unread · tap one to read it` : 'All caught up'}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-box px-2 text-sm text-amber hover:text-paper"
          >
            <CheckCheck aria-hidden className="h-4 w-4" />
            Read all
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState title="Nothing yet" body="Announcements and updates will show up here." />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((notification) => (
            <li key={notification.id}>
              <NotificationRow notification={notification} onOpen={() => openMessage(notification)} />
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open ? headingOf(open) : ''}
        actions={
          <Button type="button" onClick={() => setOpenId(null)}>
            Got it
          </Button>
        }
      >
        {open && (
          <>
            <p className="type-label m-0">{formatLongDate(open.createdAt)}</p>
            <p className="m-0 whitespace-pre-line text-paper">{open.body}</p>
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function NotificationRow({ notification, onOpen }: { notification: Notification; onOpen: () => void }) {
  const unread = !notification.readAt;
  const Icon = KIND[notification.kind].icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-box border px-3 py-3 text-left transition-colors active:bg-ash-hi ${
        unread ? 'border-ember/40 bg-ash' : 'border-[color:var(--rule)]'
      }`}
    >
      <span
        className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full ${
          unread ? 'bg-ember/15 text-ember' : 'bg-ash text-taupe'
        }`}
      >
        <Icon aria-hidden className="h-5 w-5" />
        {unread && <span aria-hidden className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-ink bg-ember" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate ${unread ? 'font-semibold text-paper' : 'text-paper-dim'}`}>{headingOf(notification)}</span>
          <span className="shrink-0 text-xs text-taupe">{formatTimeAgo(notification.createdAt)}</span>
        </span>
        <span className={`line-clamp-1 text-sm ${unread ? 'text-paper-dim' : 'text-taupe'}`}>{notification.body}</span>
        {unread && <span className="sr-only">Unread</span>}
      </span>
      <ChevronRight aria-hidden className={`h-5 w-5 shrink-0 ${unread ? 'text-paper-dim' : 'text-taupe-dim'}`} />
    </button>
  );
}
