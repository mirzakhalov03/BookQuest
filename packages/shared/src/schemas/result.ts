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
  leaderboard: z.array(resultEntrySchema),
  publishedAt: z.string()
});

export type QuestResults = z.infer<typeof questResultsSchema>;

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
  /** Null means a completion certificate rather than a placing. */
  rank: z.number().int().positive().nullable(),
  issuedAt: z.string()
});

export type CertificateData = z.infer<typeof certificateDataSchema>;
