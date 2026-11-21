import winnerArt from '@/assets/certificates/gold.svg?no-inline';
import participantArt from '@/assets/certificates/participant.svg?no-inline';

/** The fixed samples the API renders (`certificates/samples.ts`) that the admin page previews. */
export const PREVIEW_SAMPLES = [
  { key: 'winner1', tier: 'winner', placing: 1 },
  { key: 'winner4', tier: 'winner', placing: 4 },
  { key: 'participant', tier: 'participant', placing: null }
] as const;

export type PreviewSampleKey = (typeof PREVIEW_SAMPLES)[number]['key'];

const isMock = import.meta.env.VITE_MOCK_API === 'true' || import.meta.env.VITE_MOCK_API === '1';

/**
 * Public sample images: fixed data, stamped SAMPLE. Public because an `<img>`
 * can't send the admin token, and harmless because nobody can choose the name.
 * `version` busts the cache after a design upload.
 */
export function certificatePreviewUrl(sample: (typeof PREVIEW_SAMPLES)[number], version = ''): string {
  if (isMock) return sample.tier === 'winner' ? winnerArt : participantArt;
  return `${import.meta.env.VITE_API_URL}/certificates/preview/${sample.key}.png${version ? `?v=${version}` : ''}`;
}
