import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CertificateDelivery } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

const POLL_MS = 2000;

export function useCertificateDelivery() {
  return useQuery({
    queryKey: adminKeys.certificateDelivery(),
    queryFn: () => api.get<CertificateDelivery>('/admin/certificates/delivery'),
    // Same rule as broadcasts: poll only while a send is running.
    refetchInterval: (query) => (query.state.data?.status === 'sending' ? POLL_MS : false)
  });
}

export function useSendCertificates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<CertificateDelivery>('/admin/certificates/send', {}),
    // The answer says "sending", which switches the status query's polling on.
    onSuccess: (data) => queryClient.setQueryData(adminKeys.certificateDelivery(), data)
  });
}
