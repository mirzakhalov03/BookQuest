import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Client state only: who this browser believes it is. Everything the server
 * owns — the quest, the deadline, the leaderboard — belongs to React Query,
 * not here.
 */
interface SessionState {
  participantNumber: number | null;
  fullName: string | null;
  setParticipant: (participant: { number: number; fullName: string }) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      participantNumber: null,
      fullName: null,
      setParticipant: ({ number, fullName }) =>
        set({ participantNumber: number, fullName }),
      clear: () => set({ participantNumber: null, fullName: null })
    }),
    { name: 'bookquest.session' }
  )
);

export const useIsRegistered = (): boolean =>
  useSessionStore((state) => state.participantNumber !== null);
