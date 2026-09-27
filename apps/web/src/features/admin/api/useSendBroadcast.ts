import { useMutation } from '@tanstack/react-query';
import type { Broadcast, CreateBroadcastPayload } from '@bookquest/shared';
import { api } from '@/lib/api/client';

export function useSendBroadcast() {
  return useMutation({
    mutationFn: (payload: CreateBroadcastPayload) => api.post<Broadcast>('/admin/broadcasts', payload)
  });
}
