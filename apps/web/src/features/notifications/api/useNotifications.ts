import { useQuery } from '@tanstack/react-query';
import type { Notification } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { notificationKeys } from './notificationKeys';

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.mine(),
    queryFn: () => api.get<Notification[]>('/me/notifications')
  });
}
