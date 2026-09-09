import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ContactMethod } from '@bookquest/shared';

/**
 * "How we reach you" remembers the choice (spec §5) — the one registration
 * preference worth a return visit finding still set. Everything else about
 * the form is local `useState` and never leaves it.
 */
interface ContactMethodState {
  method: ContactMethod;
  setMethod: (method: ContactMethod) => void;
}

export const useContactMethodStore = create<ContactMethodState>()(
  persist(
    (set) => ({
      method: 'telegram',
      setMethod: (method) => set({ method })
    }),
    { name: 'bookquest.contact-method' }
  )
);
