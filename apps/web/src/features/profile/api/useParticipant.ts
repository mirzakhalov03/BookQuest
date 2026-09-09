import { useQuery } from '@tanstack/react-query';
import type { Participant } from '@bookquest/shared';
import { api } from '@/lib/api/client';

// Not exported: nothing outside this file invalidates or reads the self-view
// by key, and `byNumber` — the one entry that would have let something else
// key a lookup by participant number — never had a caller at all.
const participantKeys = {
  all: ['participants'] as const,
  me: () => [...participantKeys.all, 'me'] as const
};

/**
 * The self-view — the only response that includes `contact` (spec, contract),
 * and the one source of truth for the signed-in participant's number
 * (spec §5).
 */
export function useParticipant() {
  return useQuery({
    queryKey: participantKeys.me(),
    queryFn: () => api.get<Participant>('/participants/me')
  });
}
