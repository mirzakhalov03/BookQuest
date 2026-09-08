import { useRouteError } from 'react-router';
import { ErrorState } from '@/components/feedback/ErrorState';

/**
 * Wired as the router's `errorElement` on the root route, so a thrown render
 * or loader error anywhere in the route tree lands here instead of React
 * Router's blank default crash page. `useRouteError` only resolves inside a
 * route tree — that's why this is separate from `ErrorBoundary`, which
 * catches everything *outside* it.
 *
 * `body` isn't ink-dark like `AppLayout`'s atmosphere layer, but base.css
 * already puts `background: var(--color-ink)` on `<body>`, so even without
 * that layer this never shows a white screen.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  return (
    <div className="flex min-h-dvh flex-col">
      <ErrorState error={error} onRetry={() => window.location.assign('/')} retryLabel="Back to start" />
    </div>
  );
}
