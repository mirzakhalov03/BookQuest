import { useQuery } from '@tanstack/react-query';
import type { Notification } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { readToken } from '@/lib/auth/tokenStore';
import { notificationKeys } from './notificationKeys';

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.mine(),
    queryFn: () => api.get<Notification[]>('/me/notifications'),
    // Without a token there is nobody to ask — same gate `useAuth` puts on
    // its own query, so a signed-out visitor never spends a guaranteed 401.
    enabled: readToken() !== null
  });
}
