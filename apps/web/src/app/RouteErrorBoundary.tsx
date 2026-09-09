import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
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

  // A thrown `Response` rather than a render/loader failure. The router's
  // own catch-all route (`router.tsx`) intercepts a plain mistyped URL
  // before it ever gets here, but any future loader that throws a `Response`
  // lands the same way — this is the product's own voice for that, not
  // `ErrorState`'s "couldn't reach BookQuest," which is written for a real
  // network failure and would otherwise be the only thing this boundary
  // could say.
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Screen>
          <EmptyState
            title="Nothing here"
            body="That page doesn't exist. Check the address, or head back to the stage."
          />
        </Screen>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <ErrorState error={error} onRetry={() => window.location.assign('/')} retryLabel="Back to start" />
    </div>
  );
}
