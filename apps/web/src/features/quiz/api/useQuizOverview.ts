import { useQuery } from '@tanstack/react-query';
import type { QuizOverview } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { timed } from '../lib/serverClock';
import { quizKeys } from './quizKeys';

/** `/quiz` for a signed-in reader. Fresh on every visit and focus: the state turns on the clock. */
export function useQuizOverview(enabled = true) {
  return useQuery({
    queryKey: quizKeys.me(),
    queryFn: ({ signal }) => timed(() => api.get<QuizOverview>('/quiz/me', { timeoutMs: 8000, signal })),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true
  });
}
