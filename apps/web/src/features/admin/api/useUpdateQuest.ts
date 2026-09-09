import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Quest, UpdateQuestPayload } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { questKeys } from '@/lib/api/quest';
import { adminKeys } from './adminKeys';

/**
 * `PATCH /admin/quests/:id`. The caller builds `patch` itself — this hook
 * does no merging or diffing, it only sends what it's handed and refreshes
 * what could now be stale.
 *
 * `questKeys.current()` is the same cache Home, `/book` and this editor's own
 * initial load all read (spec §6: one resource, several views), so seeding
 * it with the server's answer means every one of those screens shows the
 * edit immediately rather than waiting on its own refetch.
 */
export function useUpdateQuest(questId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UpdateQuestPayload) => api.patch<Quest>(`/admin/quests/${questId}`, patch),
    onSuccess: (quest) => {
      queryClient.setQueryData(questKeys.current(), quest);
      void queryClient.invalidateQueries({ queryKey: questKeys.current() });
      // The dashboard's `phase` and the editor's own next load both read
      // through here.
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    }
  });
}
