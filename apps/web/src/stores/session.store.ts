import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Client state only: an optimistic first-paint hint, nothing more.
 *
 * `/auth/me` and `/participants/me` are the source of truth for who is
 * registered and what their number is — React Query owns both, and whatever
 * it resolves always wins. This store used to also cache `fullName` and
 * expose `useIsRegistered`, a boolean nothing else in the app was allowed to
 * decide anything from — a session revoked or a registration undone
 * server-side would leave both quietly wrong. Neither pulled its weight, so
 * both are gone: `fullName` render nowhere off this store, and `number` stays
 * only so a returning visitor's first paint can lean towards "you're in"
 * before the auth query settles — never as something anything is gated on.
 */
interface SessionState {
  participantNumber: number | null;
  setParticipantNumber: (number: number) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      participantNumber: null,
      setParticipantNumber: (number) => set({ participantNumber: number }),
      clear: () => set({ participantNumber: null })
    }),
    { name: 'bookquest.session' }
  )
);
