import type { CertificateData, CertificateTier } from '@bookquest/shared';

/*
 * Text laid over the organisers' uploaded artwork. Boxes are in layout pixels (1123×794, rendered 2×).
 * Starting positions for a typical centred landscape certificate — tune them against the real art.
 * Satori rules: display:flex on anything with more than one child, inline styles, loaded fonts only.
 */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  align?: 'flex-start' | 'center' | 'flex-end';
}

interface TierLayout {
  name: Box;
  rank?: Box;
  book: Box;
  code: Box;
  qr: Box;
  color: string;
  muted: string;
}

const LAYOUT: Record<CertificateTier, TierLayout> = {
  winner: {
    rank: { x: 161, y: 250, w: 800, h: 48, align: 'center' },
    name: { x: 111, y: 318, w: 900, h: 96, align: 'center' },
    book: { x: 161, y: 432, w: 800, h: 60, align: 'center' },
    code: { x: 760, y: 700, w: 220, h: 24, align: 'flex-end' },
    qr: { x: 990, y: 630, w: 96, h: 96 },
    color: '#14100C',
    muted: '#4A3F35'
  },
  participant: {
    name: { x: 111, y: 300, w: 900, h: 96, align: 'center' },
    book: { x: 161, y: 414, w: 800, h: 60, align: 'center' },
    code: { x: 760, y: 700, w: 220, h: 24, align: 'flex-end' },
    qr: { x: 990, y: 630, w: 96, h: 96 },
    color: '#14100C',
    muted: '#4A3F35'
  }
};

// Satori can't auto-fit text, so the name steps down by length.
function nameSize(name: string): number {
  if (name.length <= 16) return 72;
  if (name.length <= 22) return 60;
  if (name.length <= 28) return 50;
  return 42;
}

const place = (box: Box) =>
  ({
    position: 'absolute',
    left: box.x,
    top: box.y,
    width: box.w,
    height: box.h,
    display: 'flex',
    alignItems: 'center',
    justifyContent: box.align ?? 'center',
    textAlign: box.align === 'flex-end' ? 'right' : box.align === 'flex-start' ? 'left' : 'center'
  }) as const;

export function ArtworkTemplate({
  data,
  qrDataUri,
  backgroundDataUri,
  watermark
}: {
  data: CertificateData;
  qrDataUri: string;
  backgroundDataUri: string;
  watermark: React.ReactNode;
}) {
  const layout = LAYOUT[data.tier];
  return (
    <div
      style={{
        width: 1123,
        height: 794,
        display: 'flex',
        position: 'relative',
        fontFamily: 'Archivo, Noto Sans',
        color: layout.color
      }}
    >
      <img src={backgroundDataUri} width={1123} height={794} style={{ position: 'absolute', left: 0, top: 0, objectFit: 'cover' }} />

      {layout.rank && data.placing && (
        <div style={{ ...place(layout.rank), fontSize: 30, fontWeight: 800, letterSpacing: 1 }}>{`${data.placing}-o‘rin`}</div>
      )}
      <div style={{ ...place(layout.name), fontSize: nameSize(data.fullName), fontWeight: 800 }}>{data.fullName}</div>
      <div style={{ ...place(layout.book), fontSize: 20, color: layout.muted }}>
        {`«${data.bookTitle}» — ${data.bookAuthor} · BookQuest ${data.questYear}`}
      </div>
      <div style={{ ...place(layout.code), fontSize: 14, fontWeight: 700 }}>{data.code}</div>
      <img src={qrDataUri} width={layout.qr.w} height={layout.qr.h} style={{ position: 'absolute', left: layout.qr.x, top: layout.qr.y }} />
      {watermark}
    </div>
  );
}
