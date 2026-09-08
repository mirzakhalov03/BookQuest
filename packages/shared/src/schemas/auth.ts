import { z } from 'zod';
import { sessionUserSchema } from './user.js';

/**
 * The raw initData string exactly as Telegram handed it to the Mini App —
 * unparsed, because the signature covers the string itself. Re-serialising it
 * on the client would invalidate the hash.
 */
export const telegramAuthSchema = z.object({
  initData: z.string().min(1, 'Missing Telegram sign-in data.').max(4096)
});

export type TelegramAuthPayload = z.infer<typeof telegramAuthSchema>;

export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: sessionUserSchema
});

export type Session = z.infer<typeof sessionSchema>;
