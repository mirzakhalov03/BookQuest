import { RotateCw } from 'lucide-react';
import { useT } from '@/i18n';

interface RefreshButtonProps {
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * Icon only: pull-to-refresh is the main way on a phone; this is for desktop.
 * Spins while any fetch is in flight, the background poll included, so the screen admits it is updating.
 */
export function RefreshButton({ onRefresh, refreshing }: RefreshButtonProps) {
  const t = useT().admin;
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      aria-label={t.refresh}
      title={t.refresh}
      className="grid size-11 place-items-center rounded-full text-taupe transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:cursor-wait"
    >
      <RotateCw aria-hidden className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
    </button>
  );
}
