import { useQuery } from '@tanstack/react-query';
import type { AdminStats } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => api.get<AdminStats>('/admin/stats')
  });
}
