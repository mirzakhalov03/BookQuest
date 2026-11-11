import { useQuery } from '@tanstack/react-query';
import type { CertificateData } from '@bookquest/shared';
import { api, isNotFound } from '@/lib/api/client';

/** Public lookup by code. `code` is already normalised; null means there's nothing to look up yet. */
export function useVerifiedCertificate(code: string | null) {
  return useQuery({
    queryKey: ['certificate', 'verify', code],
    queryFn: () => api.get<CertificateData>(`/certificates/${encodeURIComponent(code ?? '')}`),
    enabled: code !== null,
    // A wrong code is an answer, not a blip worth retrying.
    retry: (count, error) => !isNotFound(error) && count < 2,
    // An issued certificate never changes, short of a name correction.
    staleTime: Infinity
  });
}
