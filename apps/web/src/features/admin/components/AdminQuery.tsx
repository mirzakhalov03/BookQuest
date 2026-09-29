import type { ReactNode } from 'react';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { isNotFound, type ApiRequestError } from '@/lib/api/client';
import { ForbiddenState, isForbidden } from './ForbiddenState';

/** Structural, so plain and infinite queries both fit. */
interface QueryLike<T> {
  data: T | undefined;
  error: unknown;
  isPending: boolean;
  refetch: () => unknown;
}

interface AdminQueryProps<T> {
  query: QueryLike<T>;
  loadingLabel: string;
  /** Omit and a 404 renders as an ordinary error. */
  notFound?: (error: ApiRequestError) => ReactNode;
  children: (data: T) => ReactNode;
}

/** The loading → 403 → 404 → error ladder every admin screen used to spell out itself. */
export function AdminQuery<T>({ query, loadingLabel, notFound, children }: AdminQueryProps<T>) {
  // Data first: a failed background refetch keeps the last good screen instead of blanking it.
  if (query.data !== undefined) return <>{children(query.data)}</>;

  if (query.error) {
    if (isForbidden(query.error)) return <ForbiddenState error={query.error} />;
    if (notFound && isNotFound(query.error)) return <>{notFound(query.error)}</>;
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} className="flex-1" />;
  }

  return <LoadingState label={loadingLabel} />;
}
