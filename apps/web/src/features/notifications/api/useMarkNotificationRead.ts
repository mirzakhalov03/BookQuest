import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { NotificationFeed } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { notificationKeys } from './notificationKeys';

type Context = { previous?: NotificationFeed };

/**
 * Both marks are optimistic: opening a message must clear its dot at once, not after a round trip.
 * On failure the feed snaps back to what it was.
 */
function optimistic<V>(queryClient: QueryClient, patch: (feed: NotificationFeed, vars: V, now: string) => NotificationFeed) {
  return {
    onMutate: async (vars: V): Promise<Context> => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.mine() });
      const previous = queryClient.getQueryData<NotificationFeed>(notificationKeys.mine());
      if (previous) queryClient.setQueryData(notificationKeys.mine(), patch(previous, vars, new Date().toISOString()));
      return { previous };
    },
    onError: (_error: unknown, _vars: V, context: Context | undefined) => {
      if (context?.previous) queryClient.setQueryData(notificationKeys.mine(), context.previous);
    }
  };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/me/notifications/${id}/read`, {}),
    ...optimistic<string>(queryClient, (feed, id, now) => {
      const wasUnread = feed.items.some((item) => item.id === id && !item.readAt);
      return {
        items: feed.items.map((item) => (item.id === id && !item.readAt ? { ...item, readAt: now } : item)),
        unreadCount: wasUnread ? Math.max(0, feed.unreadCount - 1) : feed.unreadCount
      };
    })
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/me/notifications/read-all', {}),
    ...optimistic<void>(queryClient, (feed, _vars, now) => ({
      items: feed.items.map((item) => (item.readAt ? item : { ...item, readAt: now })),
      unreadCount: 0
    }))
  });
}
