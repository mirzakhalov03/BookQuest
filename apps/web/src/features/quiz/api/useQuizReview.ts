import { useQuery } from '@tanstack/react-query';
import type { AttemptReview } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { quizKeys } from './quizKeys';

/** Own answers with the key; the API 404s until the quiz closes. */
export function useQuizReview() {
  return useQuery({
    queryKey: quizKeys.review(),
    queryFn: ({ signal }) => api.get<AttemptReview>('/quiz/attempt/review', { timeoutMs: 8000, signal }),
    staleTime: 60_000,
    retry: false
  });
}
