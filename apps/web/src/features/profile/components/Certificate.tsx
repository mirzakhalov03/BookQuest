import type { CertificateData } from '@bookquest/shared';
import { Rule } from '@/components/ui/Rule';
import { Button } from '@/components/ui/Button';
import { formatLongDate, formatOrdinal, formatOrdinalEdition } from '@/lib/format';

/**
 * Rendered straight from `CertificateData` — the same tokens, wide-Archivo
 * display type and gold rules as the rest of the product (plan Phase 5), not
 * a second design language for one document. Its visual design is
 * frontend-owned and static (spec §11): everything that could change between
 * two certificates already arrived as data.
 *
 * `rank: null` is a completion certificate, not a placing, and the copy below
 * is written so neither reads as the lesser of the two (spec, contract) —
 * both are simply what happened.
 *
 * Saving it is `window.print()` plus `.certificate-print` in `results.css`
 * (TBD-3: client-rendered, no new dependency) — the button below is the only
 * "download" this has, and the browser's own print-to-PDF is the file.
 */
export function Certificate({ data }: { data: CertificateData }) {
  return (
    <div className="certificate-print flex flex-col items-start gap-4">
      <div className="certificate">
        <p className="certificate__eyebrow type-label">
          BookQuest · {formatOrdinalEdition(data.questEdition)} edition · {data.questYear}
        </p>

        <Rule variant="gold" />

        <p className="certificate__kind type-label">
          {data.rank === null ? 'Certificate of completion' : 'Certificate of achievement'}
        </p>
        <h2 className="certificate__name type-display">{data.fullName}</h2>
        <p className="certificate__body">
          {data.rank === null
            ? 'completed BookQuest, reading '
            : `finished ${formatOrdinal(data.rank)} in BookQuest, reading `}
          <em>{data.bookTitle}</em> by {data.bookAuthor}.
        </p>

        <Rule variant="gold" />

        <div className="certificate__footer">
          <span>Participant {data.participantNumber}</span>
          <span>{formatLongDate(data.issuedAt)}</span>
          <span>{data.code}</span>
        </div>
      </div>

      {/* `no-print`: the certificate is the thing being saved, not this button. */}
      <Button variant="gold" className="no-print" onClick={() => window.print()}>
        Print certificate
      </Button>
    </div>
  );
}
