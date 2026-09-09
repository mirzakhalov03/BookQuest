import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Participant, RegisterParticipantInput } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { questKeys } from '@/features/home/api/useCurrentQuest';
import { authKeys } from '@/lib/auth/useAuth';
import { useSessionStore } from '@/stores/session.store';

export function useRegister() {
  const queryClient = useQueryClient();
  const setParticipantNumber = useSessionStore((state) => state.setParticipantNumber);

  return useMutation({
    mutationFn: (input: RegisterParticipantInput) =>
      api.post<Participant>('/participants', input),
    onSuccess: (participant) => {
      // First-paint hint only — `/auth/me` is what Home actually renders from.
      setParticipantNumber(participant.number);
      // The reader count on the Home stage just changed, and so did
      // `user.participant` on the auth session — both are stale until refetched.
      void queryClient.invalidateQueries({ queryKey: questKeys.current() });
      void queryClient.invalidateQueries({ queryKey: authKeys.me() });
    }
  });
}
