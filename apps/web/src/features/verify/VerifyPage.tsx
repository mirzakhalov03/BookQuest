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

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' } as const;

/**
 * `/verify` and `/verify/:code` — what the QR code on a printed certificate
 * opens. Public and session-free: it has to work in any phone's browser,
 * outside Telegram.
 */
export function VerifyPage() {
  const params = useParams();
  const code = params.code ? normalizeCertificateCode(params.code) : null;
  const certificate = useVerifiedCertificate(code);

  if (!params.code) {
    return (
      <Prompt title="Check a certificate" body="Enter the code printed beside the QR code." />
    );
  }
  if (code === null) {
    return <Prompt title="That isn’t a certificate code" body="Check it and try again." />;
  }
  if (certificate.isPending) return <LoadingState label="Checking the certificate…" />;
  if (certificate.error) {
    if (isNotFound(certificate.error)) {
      return (
        <Prompt
          title="No certificate with this code"
          body={`We couldn’t find ${code}. Check it and try again.`}
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

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalised = normalizeCertificateCode(typed);
    if (!normalised) {
      setMessage('Codes look like BQ4-K7M2QX.');
      return;
    }
    setMessage(undefined);
    navigate(`/verify/${normalised}`);
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3" noValidate>
      <Field
        label="Certificate code"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        message={message}
        status={message ? 'bad' : undefined}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="submit">Check</Button>
    </form>
  );
}

function Verified({ data }: { data: CertificateData }) {
  const rows: Array<[string, string]> = [
    ['Name', data.fullName],
    ['Edition', `${data.questEdition} · ${data.questYear}`],
    ['Book', `${data.bookTitle} by ${data.bookAuthor}`],
    ...(data.placing ? ([['Place', ORDINAL[data.placing]]] as Array<[string, string]>) : []),
    ['Participant', `№ ${data.participantNumber}`],
    ['Issued', formatDate(data.issuedAt)],
    ['Code', data.code]
  ];

  return (
    <Screen className="gap-5">
      <h1 className="m-0 flex items-center gap-2 text-lg font-semibold text-gold">
        <BadgeCheck className="h-6 w-6 shrink-0" aria-hidden="true" /> Genuine BookQuest certificate
      </h1>
      <img
        src={data.imageUrl}
        width={1123}
        height={794}
        alt={`Certificate for ${data.fullName}, BookQuest ${data.questYear}`}
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
