import type { CertificateData, CertificateTier } from '@bookquest/shared';

/*
 * PLACEHOLDER — the organiser's design replaces this file (spec §8); bump
 * TEMPLATE_VERSION in render.ts when it does. Satori rules: every element with
 * more than one child needs display:flex; inline styles only; no CSS grid;
 * fonts are only what render.ts loaded.
 */

const ACCENT: Record<CertificateTier, string> = {
  gold: '#C8A24A',
  silver: '#9AA3AD',
  bronze: '#B87344',
  participant: '#E2632A'
};

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' } as const;

// Satori can't auto-fit text, so the name steps down by length.
function nameSize(name: string): number {
  if (name.length <= 16) return 72;
  if (name.length <= 22) return 60;
  if (name.length <= 28) return 50;
  return 42;
}

interface TemplateProps {
  data: CertificateData;
  qrDataUri: string;
  sample: boolean;
}

export function CertificateTemplate({ data, qrDataUri, sample }: TemplateProps) {
  const accent = ACCENT[data.tier];
  const issued = new Date(data.issuedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div
      style={{
        width: 1123,
        height: 794,
        // Satori defaults to content-box: without this, padding + border push the footer off the canvas.
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '56px 72px 44px',
        backgroundColor: '#FFFAF3',
        border: `14px solid ${accent}`,
        fontFamily: 'Archivo, Noto Sans',
        color: '#14100C',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', fontSize: 16, fontWeight: 800, letterSpacing: 6, color: '#B84A1A' }}>
        BOOKQUEST
      </div>
      <div style={{ display: 'flex', marginTop: 6, fontSize: 13, letterSpacing: 2, color: '#6E6255' }}>
        {`EDITION ${data.questEdition} · ${data.questYear}`}
      </div>

      <div style={{ display: 'flex', marginTop: 40, fontSize: 22, fontWeight: 700, color: accent }}>
        {data.placing ? `${ORDINAL[data.placing]} place · Certificate of Achievement` : 'Certificate of Completion'}
      </div>

      <div style={{ display: 'flex', marginTop: 28, fontSize: nameSize(data.fullName), fontWeight: 800 }}>
        {data.fullName}
      </div>

      <div
        style={{
          display: 'flex',
          marginTop: 24,
          maxWidth: 760,
          textAlign: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color: '#4A3F35'
        }}
      >
        {data.placing
          ? `finished ${ORDINAL[data.placing]} among ${data.finishedCount} readers of ${data.bookTitle} by ${data.bookAuthor}.`
          : `read ${data.bookTitle} by ${data.bookAuthor} and completed the BookQuest ${data.questYear} quiz.`}
      </div>

      <div style={{ display: 'flex', flexGrow: 1 }} />

      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 14, color: '#6E6255' }}>
          <div style={{ display: 'flex' }}>BookQuest Team</div>
          <div style={{ display: 'flex' }}>{`Issued ${issued}`}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 18, fontWeight: 800, color: accent }}>
          {`№ ${data.participantNumber}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ display: 'flex', fontSize: 14, fontWeight: 700 }}>{data.code}</div>
          <img src={qrDataUri} width={96} height={96} />
        </div>
      </div>

      {sample && (
        <div
          style={{
            position: 'absolute',
            top: 300,
            left: 0,
            width: 1095,
            boxSizing: 'border-box',
            display: 'flex',
            justifyContent: 'center',
            fontSize: 140,
            fontWeight: 800,
            color: 'rgba(226, 99, 42, 0.14)',
            transform: 'rotate(-18deg)'
          }}
        >
          SAMPLE
        </div>
      )}
    </div>
  );
}
