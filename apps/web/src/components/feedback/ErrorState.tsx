import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/lib/api/errorMessage';
import { useT } from '@/i18n';

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
export function ErrorState({ error, onRetry, retryLabel, className = '' }: ErrorStateProps) {
  const t = useT();
  const message = errorMessage(error);

  return (
    <div
      role="alert"
      className={`flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center ${className}`}
    >
      <p className="type-label text-amber">{t.common.somethingWentWrong}</p>
      <p className="max-w-sm text-paper-dim">{message}</p>
      <Button variant="quiet" onClick={onRetry}>
        {retryLabel ?? t.common.tryAgain}
      </Button>
    </div>
  );
}
