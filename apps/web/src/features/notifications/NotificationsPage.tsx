import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatLongDate } from '@/lib/format';
import { useNotifications } from './api/useNotifications';
import { useMarkNotificationRead } from './api/useMarkNotificationRead';

export function NotificationsPage() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

  if (notifications.isPending) return <LoadingState label="Reading notifications…" />;
  if (notifications.error) {
    return <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />;
  }

  if (notifications.data.length === 0) {
    return (
      <Screen>
        <h1 className="type-display text-2xl text-paper">Notifications</h1>
        <EmptyState title="Nothing yet" body="Announcements and updates will show up here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <h1 className="type-display text-2xl text-paper">Notifications</h1>
      <ul className="flex flex-col gap-3">
        {notifications.data.map((notification) => (
          <li
            key={notification.id}
            className={`rounded-box border border-[color:var(--rule)] px-4 py-3 ${
              notification.readAt ? 'opacity-60' : ''
            }`}
            onClick={() => {
              if (!notification.readAt) markRead.mutate(notification.id);
            }}
          >
            <p className="type-label">{formatLongDate(notification.createdAt)}</p>
            <p className="text-paper">{notification.body}</p>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
