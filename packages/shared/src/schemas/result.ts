import { z } from 'zod';

export const resultEntrySchema = z.object({
  rank: z.number().int().positive(),
  number: z.number().int(),
  fullName: z.string(),
  score: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Tiebreaker — speed counts as much as accuracy. */
  durationMs: z.number().int().nonnegative()
});

export type ResultEntry = z.infer<typeof resultEntrySchema>;

export const questResultsSchema = z.object({
  podium: z.array(resultEntrySchema),
  /** Signed out, only the podium rows; signed in, everyone. */
  leaderboard: z.array(resultEntrySchema),
  /** How many finished, so a signed-out viewer knows what the full board holds. */
  finishedCount: z.number().int().nonnegative(),
  isFullBoard: z.boolean(),
  publishedAt: z.string()
});

export type QuestResults = z.infer<typeof questResultsSchema>;

export const CERTIFICATE_TIERS = ['gold', 'silver', 'bronze', 'participant'] as const;
export type CertificateTier = (typeof CERTIFICATE_TIERS)[number];
export type CertificatePlacing = 1 | 2 | 3;

const PODIUM_TIERS: Record<CertificatePlacing, CertificateTier> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

/** The one place a rank becomes a certificate tier, so the API and the web mock can never disagree. */
export function certificateTier(rank: number | null): {
  placing: CertificatePlacing | null;
  tier: CertificateTier;
} {
  if (rank === 1 || rank === 2 || rank === 3) return { placing: rank, tier: PODIUM_TIERS[rank] };
  return { placing: null, tier: 'participant' };
}

// Mirrors the API's code alphabet: no 0/O, 1/I/L.
const CODE_PATTERN = /^BQ(\d+)([A-HJ-NP-Z2-9]{6})$/;

/** "bq4 k7m2qx" → "BQ4-K7M2QX"; null when it can't be a code. People type these from paper. */
export function normalizeCertificateCode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = CODE_PATTERN.exec(compact);
  return match ? `BQ${match[1]}-${match[2]}` : null;
}

/**
 * Everything a certificate is rendered from. Deliberately not a stored
 * document: a certificate is a view of participant + quest + result, and a
 * second copy of a name is a copy that can drift.
 */
export const certificateDataSchema = z.object({
  code: z.string(),
  fullName: z.string(),
  participantNumber: z.number().int(),
  questEdition: z.number().int(),
  questYear: z.number().int(),
  bookTitle: z.string(),
  bookAuthor: z.string(),
  /** 1–3 for the podium, null for everyone else. Full ranks stay on the leaderboard. */
  placing: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  tier: z.enum(CERTIFICATE_TIERS),
  /** How many finished — for copy like "among 412 readers"; the design may not use it. */
  finishedCount: z.number().int().nonnegative(),
  issuedAt: z.string(),
  imageUrl: z.string().url(),
  verifyUrl: z.string().url()
});

export type CertificateData = z.infer<typeof certificateDataSchema>;

export const CERTIFICATE_DELIVERY_STATUSES = ['idle', 'sending', 'sent', 'interrupted'] as const;
export type CertificateDeliveryStatus = (typeof CERTIFICATE_DELIVERY_STATUSES)[number];

/** The admin panel's view of sending certificates for the current quest. */
export const certificateDeliverySchema = z.object({
  status: z.enum(CERTIFICATE_DELIVERY_STATUSES),
  /** Finishers on the quest. */
  total: z.number().int().nonnegative(),
  /** Photo delivered in Telegram. */
  delivered: z.number().int().nonnegative(),
  /** No Telegram linked — in-app notification and /me only. */
  inAppOnly: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  /** Telegram error; picked up again by the next press. */
  failed: z.number().int().nonnegative(),
  /** Not processed yet (includes `failed`). */
  pending: z.number().int().nonnegative(),
  /** Of `pending`, how many can be DMed — for the confirm sheet. */
  pendingReachable: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  /** The certificate design is still the placeholder, not the final artwork. */
  placeholderArt: z.boolean()
});

export type CertificateDelivery = z.infer<typeof certificateDeliverySchema>;
