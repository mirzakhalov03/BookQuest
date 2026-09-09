import { create } from 'zustand';

// Matches the prototype's say() timer (prototype/js/app.js) — long enough to
// read, short enough that it never blocks the next thing the person does.
const TOAST_DURATION_MS = 2200;

interface UiState {
  toastMessage: string | null;
  showToast: (message: string) => void;
  dismissToast: () => void;
}

// Lives outside the store: it's a handle to a side effect (a pending
// setTimeout), not state anything should render from or persist.
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Cross-tree, ephemeral state (spec §5): a screen deep in the tree fires a
 * toast, the shell renders it, and neither should have to know about the
 * other beyond this store. Not persisted — a message surviving a reload
 * would be confusing, not helpful, and the one thing worth keeping is "what
 * to show right now."
 */
export const useUiStore = create<UiState>()((set) => ({
  toastMessage: null,
  showToast: (message) => {
    clearTimeout(dismissTimer);
    set({ toastMessage: message });
    dismissTimer = setTimeout(() => set({ toastMessage: null }), TOAST_DURATION_MS);
  },
  dismissToast: () => {
    clearTimeout(dismissTimer);
    set({ toastMessage: null });
  }
}));
