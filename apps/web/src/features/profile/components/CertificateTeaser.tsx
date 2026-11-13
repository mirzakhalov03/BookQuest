import { Lock } from 'lucide-react';
import { formatLongDate } from '@/lib/format';
import { useT } from '@/i18n';

/**
 * The certificate before it exists: its silhouette, at the real certificate's
 * proportions, so the reward is visible from the first day of the quest.
 */
export function CertificateTeaser({ resultsAt }: { resultsAt: string | null }) {
  const t = useT().profile;
  return (
    <div className="cert-teaser">
      <div className="cert-teaser__sheet" aria-hidden="true">
        <span className="cert-teaser__line cert-teaser__line--title" />
        <span className="cert-teaser__line cert-teaser__line--name" />
        <span className="cert-teaser__line" />
        <span className="cert-teaser__seal" />
      </div>
      <div className="cert-teaser__copy">
        <span className="cert-teaser__lock">
          <Lock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </span>
        <p className="m-0 text-paper">{t.certTeaser}</p>
        {resultsAt && <p className="m-0 text-sm text-taupe">{t.certResultsOn(formatLongDate(resultsAt))}</p>}
      </div>
    </div>
  );
}
