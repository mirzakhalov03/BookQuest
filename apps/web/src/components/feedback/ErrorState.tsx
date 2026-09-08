import { Button } from '@/components/ui/Button';
import { ApiRequestError } from '@/lib/api/client';

// The API writes error.message for people, not for logs (spec, API contract
// conventions), so it is safe to show verbatim. Anything that isn't an
// ApiRequestError — a network failure, a timeout — never went through that
// contract and has no product-written message, so it gets a plain one instead
// of whatever the browser or fetch happened to say.
const FALLBACK_MESSAGE = "Couldn't reach BookQuest. Check your connection and try again.";

interface ErrorStateProps {
  /** Whatever a query, mutation or router error handed back. */
  error: unknown;
  onRetry: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * `error.message` verbatim, plus a retry action (spec §4). Never wraps,
 * prefixes or rephrases the message itself — the one judgment call it makes
 * is which message is fit to show at all.
 */
export function ErrorState({ error, onRetry, retryLabel = 'Try again', className = '' }: ErrorStateProps) {
  const message = error instanceof ApiRequestError ? error.message : FALLBACK_MESSAGE;

  return (
    <div
      role="alert"
      className={`flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center ${className}`}
    >
      <p className="type-label text-amber">Something went wrong</p>
      <p className="max-w-sm text-paper-dim">{message}</p>
      <Button variant="quiet" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
