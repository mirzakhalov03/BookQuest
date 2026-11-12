import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QuizCorrectionPayload, QuizCorrectionResult } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

/** Changes a locked quiz's answer key or voids a question; the server re-scores every attempt on it. */
export function useQuizCorrection(quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: QuizCorrectionPayload) =>
      api.post<QuizCorrectionResult>(`/admin/quizzes/${quizId}/corrections`, payload),
    onSuccess: ({ quiz }) => {
      queryClient.setQueryData(adminKeys.quiz(quizId), quiz);
      // The library shows the bumped revision; live averages and attempt scores move with the re-score.
      void queryClient.invalidateQueries({ queryKey: adminKeys.quizzes(), exact: true });
      void queryClient.invalidateQueries({ queryKey: adminKeys.quizOps() });
    }
  });
}
