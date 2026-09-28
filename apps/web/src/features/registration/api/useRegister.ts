import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Participant, RegisterParticipantInput } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { participantKeys } from '@/lib/api/participant';
import { questKeys } from '@/lib/api/quest';
import { authKeys } from '@/lib/auth/useAuth';

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterParticipantInput) =>
      api.post<Participant>('/participants', input),
    onSuccess: (participant) => {
      // Seeded, not invalidated: the profile must show the number the moment the reveal hands back.
      queryClient.setQueryData(participantKeys.me(), participant);
      // The reader count on the Home stage just changed, and so did
      // `user.participant` on the auth session — both are stale until refetched.
      void queryClient.invalidateQueries({ queryKey: questKeys.current() });
      void queryClient.invalidateQueries({ queryKey: authKeys.me() });
    }
  });
}
