import { isRouteErrorResponse, useRouteError } from 'react-router';
import { NotFoundScreen } from '@/components/feedback/NotFoundScreen';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useT } from '@/i18n';

/** The root route's `errorElement`. Separate from `ErrorBoundary`, which covers what's outside the route tree. */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const t = useT();

  // A thrown `Response` means "not found", not a network failure.
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex min-h-dvh flex-col">
        <NotFoundScreen />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <ErrorState error={error} onRetry={() => window.location.assign('/')} retryLabel={t.common.backToStart} />
    </div>
  );
}
