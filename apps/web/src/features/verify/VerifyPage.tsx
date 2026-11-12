import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BadgeCheck } from 'lucide-react';
import { normalizeCertificateCode, type CertificateData } from '@bookquest/shared';
import { Screen } from '@/components/layout/Screen';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { isNotFound } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { useVerifiedCertificate } from './api/useVerifiedCertificate';
import { useT } from '@/i18n';

/**
 * `/verify` and `/verify/:code` — what the QR code on a printed certificate
 * opens. Public and session-free: it has to work in any phone's browser,
 * outside Telegram.
 */
export function VerifyPage() {
  const params = useParams();
  const code = params.code ? normalizeCertificateCode(params.code) : null;
  const certificate = useVerifiedCertificate(code);
  const t = useT().verify;

  if (!params.code) {
    return (
      <Prompt title={t.promptTitle} body={t.promptBody} />
    );
  }
  if (code === null) {
    return <Prompt title={t.badCodeTitle} body={t.checkAgain} />;
  }
  if (certificate.isPending) return <LoadingState label={t.loading} />;
  if (certificate.error) {
    if (isNotFound(certificate.error)) {
      return (
        <Prompt
          title={t.notFoundTitle}
          body={t.notFoundBody(code)}
        />
      );
    }
    return <ErrorState error={certificate.error} onRetry={() => void certificate.refetch()} />;
  }

  return <Verified data={certificate.data} />;
}

function Prompt({ title, body }: { title: string; body: string }) {
  return (
    <Screen className="gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="type-display m-0 text-2xl text-paper">{title}</h1>
        <p className="m-0 text-paper-dim">{body}</p>
      </div>
      <CodeForm />
    </Screen>
  );
}

function CodeForm() {
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState<string | undefined>();
  const t = useT().verify;

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalised = normalizeCertificateCode(typed);
    if (!normalised) {
      setMessage(t.codeShape);
      return;
    }
    setMessage(undefined);
    navigate(`/verify/${normalised}`);
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3" noValidate>
      <Field
        label={t.codeLabel}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        message={message}
        status={message ? 'bad' : undefined}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="submit">{t.check}</Button>
    </form>
  );
}

function Verified({ data }: { data: CertificateData }) {
  const { common, verify: t } = useT();
  const rows: Array<[string, string]> = [
    [t.name, data.fullName],
    [t.edition, common.editionShort(data.questEdition, data.questYear)],
    [t.book, t.bookBy(data.bookTitle, data.bookAuthor)],
    ...(data.placing ? ([[t.place, common.placeShort(data.placing)]] as Array<[string, string]>) : []),
    [t.participant, `№ ${data.participantNumber}`],
    [t.issued, formatDate(data.issuedAt)],
    [t.code, data.code]
  ];

  return (
    <Screen className="gap-5">
      <h1 className="m-0 flex items-center gap-2 text-lg font-semibold text-gold">
        <BadgeCheck className="h-6 w-6 shrink-0" aria-hidden="true" /> {t.genuine}
      </h1>
      <img
        src={data.imageUrl}
        width={1123}
        height={794}
        alt={t.imageAlt(data.fullName, data.questYear)}
        className="certificate-image"
      />
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-taupe">{label}</dt>
            <dd className="m-0 break-words text-paper">{value}</dd>
          </div>
        ))}
      </dl>
    </Screen>
  );
}
