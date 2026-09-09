import { useQuery } from '@tanstack/react-query';
import type { Quest } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { questArchiveKeys } from './useQuestArchive';

/**
 * One edition, by the number people say out loud — not a database id
 * (spec, contract). The endpoint answers for the current edition too if its
 * number is asked for directly, so this never special-cases "is this the
 * live one" — it renders whatever `Quest` comes back, same as `/book` does
 * for the one that actually is current.
 */
export function useQuestByEdition(edition: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: questArchiveKeys.edition(edition),
    queryFn: () => api.get<Quest>(`/quests/${edition}`),
    enabled: options.enabled ?? true
  });
}
