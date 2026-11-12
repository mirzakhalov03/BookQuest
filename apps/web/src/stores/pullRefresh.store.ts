import { create } from 'zustand';

interface PullRefreshState {
  /** Screens currently opted in; a count, not a flag, so an overlapping mount/unmount can't switch it off. */
  owners: number;
  /** Opts the current screen in; returns the release. */
  claim: () => () => void;
}

/** Whether a pull from the top should refresh, not just stretch. Read imperatively by `useOverscroll`. */
export const usePullRefreshStore = create<PullRefreshState>()((set) => ({
  owners: 0,
  claim: () => {
    set((state) => ({ owners: state.owners + 1 }));
    return () => set((state) => ({ owners: Math.max(0, state.owners - 1) }));
  }
}));
