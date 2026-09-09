import { useQuery } from '@tanstack/react-query';
import type { CertificateData } from '@bookquest/shared';
import { api } from '@/lib/api/client';

// Not exported: nothing outside this file invalidates or reads the
// certificate by key.
const certificateKeys = {
  all: ['certificate'] as const,
  mine: () => [...certificateKeys.all, 'me'] as const
};

/**
 * The signed-in participant's certificate — `404 not_found` until the quiz
 * is done and results are published (`ProfilePage`'s `CertificateSection`
 * reads that as "not yet," not a failure).
 */
export function useCertificate() {
  return useQuery({
    queryKey: certificateKeys.mine(),
    queryFn: () => api.get<CertificateData>('/participants/me/certificate')
  });
}
