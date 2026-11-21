import { Lock } from 'lucide-react';
import { formatLongDate } from '@/lib/format';
import { useT } from '@/i18n';

/** No certificate yet: one compact row, before results (with the date) or after a missed edition. */
export function CertificateTeaser({ resultsAt, missed = false }: { resultsAt: string | null; missed?: boolean }) {
  const t = useT().profile;
  return (
    <div className="cert-teaser">
      <span className="cert-teaser__lock">
        <Lock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col">
        <p className="m-0 text-paper">{missed ? t.certMissed : t.certTeaser}</p>
        {!missed && resultsAt && <p className="m-0 text-sm text-taupe">{t.certResultsOn(formatLongDate(resultsAt))}</p>}
      </div>
    </div>
  );
}
