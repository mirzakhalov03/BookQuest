import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminQuest, UpdateQuestPayload } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { questKeys } from '@/lib/api/quest';
import { adminKeys } from './adminKeys';

/**
 * `PATCH /admin/quests/:id`. The caller builds `patch` itself — this hook
 * does no merging or diffing, it only sends what it's handed and refreshes
 * what could now be stale.
 *
 * The answer is the admin DTO (it carries `quizConfig`), so it seeds the
 * editor's own cache; the public `questKeys.current()` that Home and `/book`
 * read is refetched instead, so the setup never lands in it.
 */
export function useUpdateQuest(questId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UpdateQuestPayload) => api.patch<AdminQuest>(`/admin/quests/${questId}`, patch),
    onSuccess: (quest) => {
      queryClient.setQueryData(adminKeys.currentQuest(), quest);
      void queryClient.invalidateQueries({ queryKey: questKeys.current() });
      // The dashboard's `phase` and the editor's own next load both read
      // through here.
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    }
  });
}
