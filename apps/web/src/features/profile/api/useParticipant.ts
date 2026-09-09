import { useQuery } from '@tanstack/react-query';
import type { Participant } from '@bookquest/shared';
import { api } from '@/lib/api/client';

/** Exact shape from spec §5. */
export const participantKeys = {
  all: ['participants'] as const,
  me: () => [...participantKeys.all, 'me'] as const,
  byNumber: (n: number) => [...participantKeys.all, n] as const
};

/**
 * The self-view — the only response that includes `contact` (spec, contract).
 * `session.store.ts`'s number is a first-paint hint only; this query is the
 * one source of truth for it (spec §5), and nothing on this screen is gated
 * on the store.
 */
export function useParticipant() {
  return useQuery({
    queryKey: participantKeys.me(),
    queryFn: () => api.get<Participant>('/participants/me')
  });
}
