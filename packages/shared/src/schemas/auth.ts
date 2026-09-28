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

/**
 * What Telegram's Login Widget hands back via its callback — individual
 * fields plus a hash, not a raw string like the Mini App's `initData`. The
 * fields Telegram may omit stay optional here and become `null` once turned
 * into a `TelegramProfile` server-side (utils/telegram.ts), the same
 * normalization the bot's payload already does.
 */
export const telegramWidgetAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string()
});

export type TelegramWidgetAuthPayload = z.infer<typeof telegramWidgetAuthSchema>;

/**
 * E.164-ish: an optional leading `+`, then 8-15 digits, not starting with 0.
 * Permissive on purpose — this is a login identifier, not an SMS dispatch
 * target, so there is no carrier lookup to satisfy.
 */
const PHONE_NUMBER_PATTERN = /^\+?[1-9]\d{7,14}$/;

/**
 * Phone number + password sign-up. 72 is bcrypt's own input ceiling —
 * anything longer is silently truncated by bcrypt itself, so this rejects
 * before that point rather than hash a password the user didn't actually
 * type.
 */
export const phoneRegisterSchema = z.object({
  phoneNumber: z.string().trim().regex(PHONE_NUMBER_PATTERN, 'Enter a valid phone number.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Use at most 72 characters.'),
  firstName: z.string().trim().min(1, 'Enter your name.')
});

export type PhoneRegisterPayload = z.infer<typeof phoneRegisterSchema>;

export const phoneLoginSchema = z.object({
  phoneNumber: z.string().trim().regex(PHONE_NUMBER_PATTERN, 'Enter a valid phone number.'),
  password: z.string().min(1, 'Enter your password.')
});

export type PhoneLoginPayload = z.infer<typeof phoneLoginSchema>;
