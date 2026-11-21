import type { CertificateData, CertificateTier } from '@bookquest/shared';
import { renderCertificatePng, type CertificateBackground } from '../certificates/render.js';
import { logger } from '../config/logger.js';
import { coverIdFromUrl, openCover } from './cover.services.js';

type Designs = Partial<Record<CertificateTier, string | null>> | null | undefined;

// A design is a few MB and changes about once a year: keep the last few in memory.
const CACHE_LIMIT = 4;
const backgrounds = new Map<string, string>();

async function readAsDataUri(id: string): Promise<string> {
  const cached = backgrounds.get(id);
  if (cached) return cached;

  const file = await openCover(id);
  const chunks: Buffer[] = [];
  for await (const chunk of file.stream) chunks.push(chunk as Buffer);
  const uri = `data:${file.contentType};base64,${Buffer.concat(chunks).toString('base64')}`;

  backgrounds.set(id, uri);
  if (backgrounds.size > CACHE_LIMIT) backgrounds.delete(backgrounds.keys().next().value!);
  return uri;
}

/** The uploaded artwork for this tier, or null for the placeholder (none set, or the file is gone). */
export async function loadDesign(designs: Designs, tier: CertificateTier): Promise<CertificateBackground | null> {
  const id = coverIdFromUrl(designs?.[tier]);
  if (!id) return null;
  try {
    return { id, dataUri: await readAsDataUri(id) };
  } catch (error) {
    // A missing design must not stop certificates going out: fall back to the placeholder.
    logger.warn({ err: error, designId: id }, 'Certificate design unavailable; using placeholder art');
    return null;
  }
}

export async function renderWithDesign(data: CertificateData, designs: Designs, options: { sample?: boolean } = {}) {
  return renderCertificatePng(data, { ...options, background: await loadDesign(designs, data.tier) });
}
