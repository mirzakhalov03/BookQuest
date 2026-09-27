import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { notificationKeys } from './notificationKeys';

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<Notification>(`/me/notifications/${id}/read`, undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.mine() });
    }
  });
}
