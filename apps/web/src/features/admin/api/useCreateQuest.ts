import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateQuestPayload, Quest } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { questKeys } from '@/lib/api/quest';

export function useCreateQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateQuestPayload) => api.post<Quest>('/admin/quests', payload),
    onSuccess: (quest) => {
      queryClient.setQueryData(questKeys.current(), quest);
      // A new edition changes nearly every screen: roster, results, archive, profile, stats.
      void queryClient.invalidateQueries();
    }
  });
}
