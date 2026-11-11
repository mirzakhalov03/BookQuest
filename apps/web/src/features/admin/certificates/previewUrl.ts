import type { CertificateTier } from '@bookquest/shared';
import goldArt from '@/assets/certificates/gold.svg?no-inline';
import silverArt from '@/assets/certificates/silver.svg?no-inline';
import bronzeArt from '@/assets/certificates/bronze.svg?no-inline';
import participantArt from '@/assets/certificates/participant.svg?no-inline';

const isMock = import.meta.env.VITE_MOCK_API === 'true' || import.meta.env.VITE_MOCK_API === '1';
const MOCK_ART: Record<CertificateTier, string> = {
  gold: goldArt,
  silver: silverArt,
  bronze: bronzeArt,
  participant: participantArt
};

/**
 * Public sample images: fixed data, stamped SAMPLE. Public because an `<img>`
 * can't send the admin token, and harmless because nobody can choose the name.
 */
export function certificatePreviewUrl(tier: CertificateTier): string {
  return isMock ? MOCK_ART[tier] : `${import.meta.env.VITE_API_URL}/certificates/preview/${tier}.png`;
}
