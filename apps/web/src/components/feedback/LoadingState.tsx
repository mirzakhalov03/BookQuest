import { Spinner } from '@/components/ui/Spinner';

interface LoadingStateProps {
  /** Copy written in the screen's own voice — "Setting the stage…", not "Loading…". */
  label: string;
  className?: string;
}

/**
 * Never a spinner alone (spec §4): the spinner accompanies the words, it does
 * not replace them. A screen that only shows a ring with no label is telling
 * the person nothing about what it's doing.
 */
export function LoadingState({ label, className = '' }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center ${className}`}
    >
      <Spinner size="md" />
      <p className="type-label">{label}</p>
    </div>
  );
}
