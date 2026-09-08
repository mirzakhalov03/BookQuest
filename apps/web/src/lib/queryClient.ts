import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // A 404 or a validation failure will not fix itself on retry.
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status < 500) return false;
        return failureCount < 2;
      }
    }
  }
});
