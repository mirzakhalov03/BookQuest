import { useQuery } from '@tanstack/react-query';
import type { CertificateData } from '@bookquest/shared';
import { api, isNotFound } from '@/lib/api/client';

// Not exported: nothing outside this file invalidates or reads the
// certificate by key.
const certificateKeys = {
  all: ['certificate'] as const,
  mine: () => [...certificateKeys.all, 'me'] as const
};

// It only changes once results are published, so a revisit never needs to wait on it.
const STALE_MS = 5 * 60_000;

/**
 * The signed-in participant's certificate, or `null` until the quiz is done and results are published.
 * The server's 404 becomes data, not an error: an error has nothing to cache, so every visit would reload.
 */
export function useCertificate() {
  return useQuery({
    queryKey: certificateKeys.mine(),
    queryFn: async () => {
      try {
        return await api.get<CertificateData>('/participants/me/certificate');
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    staleTime: STALE_MS
  });
}
