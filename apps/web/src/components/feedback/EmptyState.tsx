import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** "No quest is running right now" — a plain statement, not an apology. */
  title: string;
  body?: string;
  /** A `Button` or `Link`, whichever fits — this primitive doesn't care which. */
  action?: ReactNode;
  className?: string;
}

/**
 * An invitation, not an apology (spec §4). Deliberately shares no classes or
 * markup with ErrorState: display type instead of a label eyebrow, paper
 * instead of amber, no retry framing. Nothing here should read as a failure.
 */
export function EmptyState({ title, body, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center ${className}`}
    >
      <p className="type-display text-2xl text-paper">{title}</p>
      {body && <p className="max-w-sm text-taupe">{body}</p>}
      {action}
    </div>
  );
}
