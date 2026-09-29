import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Broadcast, CreateBroadcastPayload } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

export function useSendBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBroadcastPayload) => api.post<Broadcast>('/admin/broadcasts', payload),
    // The new row arrives as "sending", which switches the history's polling on.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.broadcasts() })
  });
}
