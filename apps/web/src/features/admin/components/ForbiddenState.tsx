import { EmptyState } from '@/components/feedback/EmptyState';
import { ApiRequestError } from '@/lib/api/client';

/**
 * `403 forbidden` is a state every admin screen will actually hit — the
 * guard in `router.tsx` only stops someone with a stale "admin" session from
 * ever *seeing* this shell; it does not stop the server from correctly
 * refusing a request once the role no longer checks out (spec, plan Phase 4:
 * "a user who flips the flag in devtools sees an admin shell full of `403
 * forbidden`"). That has to render as what it is, not as a crash and not as
 * a retryable failure — retrying the same request as the same account
 * answers the same 403.
 */
export function isForbidden(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.status === 403 && error.code === 'forbidden';
}

export function ForbiddenState({ error }: { error: ApiRequestError }) {
  return (
    <EmptyState
      title="This account is not an admin"
      body={error.message}
      className="flex-1"
    />
  );
}
