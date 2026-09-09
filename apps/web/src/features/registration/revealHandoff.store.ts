import { create } from 'zustand';

/**
 * The one value that travels from a successful registration to
 * `/register/success`: the participant number the API just returned.
 *
 * Deliberately not router state. React Router keeps `location.state` on the
 * current history entry, and browsers keep that entry — state included —
 * across a plain reload of the same URL. Stashing the number there would let
 * it survive exactly the reload spec §3 says this route must reject ("direct
 * visits redirect to `/`"). A Zustand store backed by nothing but memory has
 * no such loophole: it is wiped every time the module re-executes, which a
 * hard reload always does, so "nothing here" and "should redirect" stay the
 * same fact.
 *
 * Not persisted, and not folded into `session.store.ts` (which is): this is
 * a single hand-off between two screens in one page load, not a value worth
 * surviving a reload at all — `SuccessScreen` reads it once and clears it.
 */
interface RevealHandoffState {
  number: number | null;
  setNumber: (number: number) => void;
  clear: () => void;
}

export const useRevealHandoffStore = create<RevealHandoffState>()((set) => ({
  number: null,
  setNumber: (number) => set({ number }),
  clear: () => set({ number: null })
}));
