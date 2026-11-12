import { RotateCw } from 'lucide-react';

interface RefreshButtonProps {
  onRefresh: () => void;
  refreshing: boolean;
  /** When the data on screen was fetched. */
  updatedAt?: number;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Spins while any fetch is in flight, the background poll included, so the screen admits it is updating. */
export function RefreshButton({ onRefresh, refreshing, updatedAt }: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      className="inline-flex min-h-11 items-center gap-2 rounded-box px-3 text-sm text-taupe hover:text-paper disabled:cursor-wait"
    >
      <RotateCw aria-hidden className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
      <span className="tabular-nums">{refreshing ? 'Updating…' : updatedAt ? `Updated ${clock(updatedAt)}` : 'Refresh'}</span>
    </button>
  );
}
