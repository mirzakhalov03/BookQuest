import { useQuery } from '@tanstack/react-query';
import type { QuizDistribution } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

/** Live roster split for a distribution; `sizes` is null while a random split has no seed yet. */
export function useQuizGroupSizes(distribution: QuizDistribution | null, groups: number) {
  return useQuery({
    queryKey: adminKeys.groupSizes(distribution ?? 'none', groups),
    queryFn: () =>
      api.get<{ sizes: number[] | null }>(`/admin/quiz/group-sizes?distribution=${distribution}&groups=${groups}`),
    enabled: distribution !== null,
    select: (data) => data.sizes
  });
}
