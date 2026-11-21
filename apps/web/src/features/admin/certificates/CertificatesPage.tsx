import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useAdminCurrentQuest } from '../api/useAdminCurrentQuest';
import { useCertificateDelivery } from '../api/useCertificateDelivery';
import { AdminQuery } from '../components/AdminQuery';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { CertificateDelivery } from './CertificateDelivery';
import { PREVIEW_SAMPLES, certificatePreviewUrl } from './previewUrl';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';

/**
 * `/admin/certificates` — the four tier designs as readers will get them, then
 * sending. Previews come from the server's real template, so this page can't
 * drift from what's actually delivered.
 */
export function CertificatesPage() {
  const { admin, common } = useT();
  const t = admin.certificates;
  const quest = useAdminCurrentQuest();
  const delivery = useCertificateDelivery();

  return (
    <AdminQuery
      query={quest}
      loadingLabel={t.loading}
      notFound={(error) => <EmptyState title={errorMessage(error)} body={t.noQuest} className="flex-1" />}
    >
      {(data) => (
        <AdminScreen className="max-w-4xl">
          <AdminPageHeader title={t.title} />
          {delivery.data?.placeholderArt && <p className="m-0 text-sm text-amber">{t.placeholderNote}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PREVIEW_SAMPLES.map((sample) => {
              const caption = sample.placing ? `${t.tiers.winner} · ${common.place(sample.placing)}` : t.tiers.participant;
              return (
                <figure key={sample.key} className="m-0 flex flex-col gap-1.5">
                  <img
                    src={certificatePreviewUrl(sample)}
                    width={1123}
                    height={794}
                    loading="lazy"
                    alt={t.sampleAlt(caption)}
                    className="certificate-image"
                  />
                  <figcaption className="text-sm text-taupe">{caption}</figcaption>
                </figure>
              );
            })}
          </div>

          <CertificateDelivery resultsAt={data.resultsAt} />
        </AdminScreen>
      )}
    </AdminQuery>
  );
}
