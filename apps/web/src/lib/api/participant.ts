import { useQuery } from '@tanstack/react-query';
import type { Participant } from '@bookquest/shared';
import { api } from './client';

// Shared, like `quest.ts`: the profile reads it and registration seeds it.
export const participantKeys = {
  all: ['participants'] as const,
  me: () => [...participantKeys.all, 'me'] as const
};

export function useParticipant() {
  return useQuery({
    queryKey: participantKeys.me(),
    queryFn: () => api.get<Participant>('/participants/me')
  });
}
