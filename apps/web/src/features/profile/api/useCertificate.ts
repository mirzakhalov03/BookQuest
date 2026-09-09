import { useQuery } from '@tanstack/react-query';
import type { CertificateData } from '@bookquest/shared';
import { api } from '@/lib/api/client';

/**
 * Its own root, same reasoning as `resultsKeys` — invalidating "my
 * certificate" is a different event from invalidating "my participant
 * record", even though both are read off the same person.
 */
export const certificateKeys = {
  all: ['certificate'] as const,
  mine: () => [...certificateKeys.all, 'me'] as const
};

/**
 * `enabled` defaults to on, but the profile only turns this query on once it
 * knows the caller is registered — firing it alongside `/participants/me`
 * would spend a request answering a question the other query already will.
 */
export function useCertificate(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: certificateKeys.mine(),
    queryFn: () => api.get<CertificateData>('/participants/me/certificate'),
    enabled: options.enabled ?? true
  });
}
