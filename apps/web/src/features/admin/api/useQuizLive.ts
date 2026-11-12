import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttemptAdmin,
  AttemptRow,
  AttemptStatus,
  Paginated,
  QuizFlag,
  QuizLiveStats,
  QuizStandings,
  VoidAttemptPayload
} from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

const LIVE_POLL_MS = 15_000;

/** Polls while the tab is visible (§5.4). */
export function useQuizLive() {
  return useQuery({
    queryKey: adminKeys.quizLive(),
    queryFn: () => api.get<QuizLiveStats>('/admin/quiz/live'),
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false
  });
}

/** Ranked finishers plus who is still solving; polled like the live tiles. */
export function useQuizStandings() {
  return useQuery({
    queryKey: adminKeys.quizStandings(),
    queryFn: () => api.get<QuizStandings>('/admin/quiz/standings'),
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false
  });
}

/** DMs the full answer sheet to the signed-in admin's Telegram. */
export function useSendAnswerSheet() {
  return useMutation({
    mutationFn: (attemptId: string) => api.post<null>(`/admin/quiz/attempts/${attemptId}/sheet`, {})
  });
}

export interface AttemptFilters {
  status: AttemptStatus | '';
  flag: QuizFlag | '';
  q: string;
}

const PAGE_SIZE = 50;

export function useQuizAttempts(filters: AttemptFilters) {
  return useInfiniteQuery({
    queryKey: adminKeys.quizAttempts(filters),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: String(PAGE_SIZE) });
      if (filters.status) params.set('status', filters.status);
      if (filters.flag) params.set('flag', filters.flag);
      if (filters.q) params.set('q', filters.q);
      return api.get<Paginated<AttemptRow>>(`/admin/quiz/attempts?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    // Rows move as people finish, so the list refreshes with the tiles.
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false
  });
}

export function useQuizAttempt(id: string | null) {
  return useQuery({
    queryKey: adminKeys.quizAttempt(id ?? ''),
    queryFn: () => api.get<AttemptAdmin>(`/admin/quiz/attempts/${id}`),
    enabled: id !== null
  });
}

export function useVoidAttempt(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VoidAttemptPayload) => api.post<AttemptRow>(`/admin/quiz/attempts/${id}/void`, payload),
    onSuccess: () => {
      // Live tiles, the list and the detail all change; so does the dashboard's Quiz submitted.
      void queryClient.invalidateQueries({ queryKey: adminKeys.quizOps() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    }
  });
}
