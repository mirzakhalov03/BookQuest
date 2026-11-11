import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori, { type SatoriOptions } from 'satori';
import { renderAsync } from '@resvg/resvg-js';
import QRCode from 'qrcode';
import type { CertificateData } from '@bookquest/shared';
import { CertificateTemplate } from './template.js';

/** Bump whenever template.tsx changes: it's part of every cache key and ETag. */
export const TEMPLATE_VERSION = 1;

const WIDTH = 1123;
const HEIGHT = 794;
/** 2× the layout size: ≈190 dpi on A4, sharp in print, a few hundred KB to send. */
const PNG_WIDTH = WIDTH * 2;
const CACHE_LIMIT = 200;
/**
 * Rasterising runs off-thread, but satori and the PNG encode (~60 ms) don't. A cap keeps a
 * delivery of hundreds from stacking those on the event loop and stalling every other request.
 */
const MAX_CONCURRENT_RENDERS = 1;

const require = createRequire(import.meta.url);
type Font = SatoriOptions['fonts'][number];

// .woff, never .woff2: satori can't read woff2.
function font(file: string, name: string, weight: Font['weight']): Font {
  return { name, weight, style: 'normal', data: readFileSync(require.resolve(file)) };
}

// Loaded once at import. Archivo for Latin; Noto Sans is the fallback that covers Cyrillic names.
const WEIGHTS = [400, 700, 800] as const;
const FONTS: Font[] = [
  ...WEIGHTS.flatMap((weight) => [
    font(`@fontsource/archivo/files/archivo-latin-${weight}-normal.woff`, 'Archivo', weight),
    font(`@fontsource/archivo/files/archivo-latin-ext-${weight}-normal.woff`, 'Archivo', weight)
  ]),
  ...WEIGHTS.map((weight) =>
    font(`@fontsource/noto-sans/files/noto-sans-cyrillic-${weight}-normal.woff`, 'Noto Sans', weight)
  )
];

/** Insertion-ordered Map as an LRU: a hit is re-inserted at the end, the oldest entry is evicted first. */
const cache = new Map<string, Buffer>();

function remember(key: string, png: Buffer): void {
  cache.set(key, png);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

let activeRenders = 0;
const waitingRenders: Array<() => void> = [];

async function withRenderSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeRenders < MAX_CONCURRENT_RENDERS) activeRenders += 1;
  else await new Promise<void>((resolve) => waitingRenders.push(resolve));
  try {
    return await work();
  } finally {
    // Hand the slot straight to the next waiter, so a newcomer can't slip in between and exceed the cap.
    const next = waitingRenders.shift();
    if (next) next();
    else activeRenders -= 1;
  }
}

async function qrDataUri(url: string): Promise<string> {
  // Dark on white whatever the design's background, with a 4-module quiet zone, so phone cameras read it.
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4,
    color: { dark: '#14100C', light: '#FFFFFF' }
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function renderCertificatePng(
  data: CertificateData,
  options: { sample?: boolean } = {}
): Promise<{ png: Buffer; etag: string }> {
  const sample = options.sample ?? false;
  // The data is part of the key, so a corrected name re-renders without anyone invalidating anything.
  const etag = createHash('sha256')
    .update(JSON.stringify({ v: TEMPLATE_VERSION, sample, data }))
    .digest('base64url')
    .slice(0, 27);

  const cached = cache.get(etag);
  if (cached) {
    cache.delete(etag);
    cache.set(etag, cached);
    return { png: cached, etag };
  }

  const png = await withRenderSlot(async () => {
    const element = CertificateTemplate({ data, qrDataUri: await qrDataUri(data.verifyUrl), sample });
    const svg = await satori(element, { width: WIDTH, height: HEIGHT, fonts: FONTS });
    // renderAsync rasterises on the libuv pool; the sync Resvg render blocks the event loop ~350 ms.
    const rendered = await renderAsync(svg, {
      fitTo: { mode: 'width', value: PNG_WIDTH },
      font: { loadSystemFonts: false }
    });
    return rendered.asPng();
  });

  remember(etag, png);
  return { png, etag };
}
