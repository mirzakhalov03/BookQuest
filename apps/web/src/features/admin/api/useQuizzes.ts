import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateQuizPayload, QuizAdmin, QuizSummaryAdmin, SaveQuizPayload } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

export function useQuizzes() {
  return useQuery({
    queryKey: adminKeys.quizzes(),
    queryFn: () => api.get<QuizSummaryAdmin[]>('/admin/quizzes')
  });
}

export function useQuiz(id: string) {
  return useQuery({
    queryKey: adminKeys.quiz(id),
    queryFn: () => api.get<QuizAdmin>(`/admin/quizzes/${id}`)
  });
}

/** Refreshes the library list; the per-quiz caches are keyed under it, so they refresh too. */
function useRefreshLibrary() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.quizzes(), exact: true });
}

export function useCreateQuiz() {
  const refresh = useRefreshLibrary();
  return useMutation({
    mutationFn: (payload: CreateQuizPayload) => api.post<QuizAdmin>('/admin/quizzes', payload),
    onSuccess: () => void refresh()
  });
}

export function useSaveQuiz(id: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshLibrary();
  return useMutation({
    mutationFn: (payload: SaveQuizPayload) => api.put<QuizAdmin>(`/admin/quizzes/${id}`, payload),
    onSuccess: (quiz) => {
      queryClient.setQueryData(adminKeys.quiz(id), quiz);
      void refresh();
    }
  });
}

export function useDuplicateQuiz() {
  const refresh = useRefreshLibrary();
  return useMutation({
    mutationFn: (id: string) => api.post<QuizAdmin>(`/admin/quizzes/${id}/duplicate`, {}),
    onSuccess: () => void refresh()
  });
}

export function useDeleteQuiz() {
  const refresh = useRefreshLibrary();
  return useMutation({
    mutationFn: (id: string) => api.delete<unknown>(`/admin/quizzes/${id}`),
    onSuccess: () => void refresh()
  });
}
