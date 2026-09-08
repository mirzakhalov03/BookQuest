import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Participant, RegisterParticipantInput } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { questKeys } from '@/features/home/api/useCurrentQuest';
import { useSessionStore } from '@/stores/session.store';

export function useRegister() {
  const queryClient = useQueryClient();
  const setParticipant = useSessionStore((state) => state.setParticipant);

  return useMutation({
    mutationFn: (input: RegisterParticipantInput) =>
      api.post<Participant>('/participants', input),
    onSuccess: (participant) => {
      setParticipant({ number: participant.number, fullName: participant.fullName });
      // The reader count on the Home stage just changed.
      void queryClient.invalidateQueries({ queryKey: questKeys.current() });
    }
  });
}
