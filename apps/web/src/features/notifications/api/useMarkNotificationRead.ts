import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Notification, NotificationFeed } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { notificationKeys } from './notificationKeys';

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<Notification>(`/me/notifications/${id}/read`, undefined),
    // Patch the one row from the response instead of refetching the whole feed.
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationFeed>(notificationKeys.mine(), (feed) => {
        if (!feed) return feed;
        const wasUnread = feed.items.some((item) => item.id === updated.id && !item.readAt);
        return {
          items: feed.items.map((item) => (item.id === updated.id ? updated : item)),
          unreadCount: wasUnread ? Math.max(0, feed.unreadCount - 1) : feed.unreadCount
        };
      });
    }
  });
}
