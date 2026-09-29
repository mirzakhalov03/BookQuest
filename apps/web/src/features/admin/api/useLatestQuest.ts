import { useQuery } from '@tanstack/react-query';
import type { CursorPage, Quest, QuestSummary } from '@bookquest/shared';
import { api, isNotFound } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

export type LatestQuest = { quest: Quest; isCurrent: boolean } | null;

/** What the next edition copies from: the current quest, else the newest archived one, else nothing (edition 1). */
export function useLatestQuest() {
  return useQuery({
    queryKey: adminKeys.latestQuest(),
    queryFn: async (): Promise<LatestQuest> => {
      try {
        return { quest: await api.get<Quest>('/quests/current'), isCurrent: true };
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      const archive = await api.get<CursorPage<QuestSummary>>('/quests?limit=1');
      const newest = archive.items[0];
      return newest ? { quest: await api.get<Quest>(`/quests/${newest.edition}`), isCurrent: false } : null;
    }
  });
}
