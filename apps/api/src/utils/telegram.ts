import crypto from 'node:crypto';
import { z } from 'zod';
import type { TelegramWidgetAuthPayload } from '@bookquest/shared';
import { env } from '../config/env.js';

export interface TelegramProfile {
  telegramUserId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  languageCode: string | null;
}

export type InitDataResult =
  | { ok: true; profile: TelegramProfile; authDate: Date }
  | { ok: false; reason: string };

/** Telegram sends snake_case; `id` arrives as a JSON number and is kept as a string. */
const telegramUserSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  language_code: z.string().optional()
});

/**
 * Verifies the `initData` string a Telegram Mini App hands the frontend.
 *
 * This function is the entire security boundary: everything downstream trusts
 * whatever comes out of it, so it is written once and never inlined.
 *
 *   1. parse, lift out `hash`
 *   2. data-check string = remaining `key=value` pairs, sorted, joined with \n
 *   3. secret = HMAC_SHA256(key: "WebAppData", data: BOT_TOKEN)
 *   4. expected = HMAC_SHA256(key: secret, data: dataCheckString)
 *   5. constant-time compare
 *   6. reject a stale auth_date
 *
 * The failure `reason` is for logs only. Callers answer a flat 401 — telling a
 * caller *which* check failed helps nobody but an attacker.
 */
export function verifyInitData(initData: string, now: Date = new Date()): InitDataResult {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: 'unparsable initData' };
  }

  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing hash' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(env.TELEGRAM_BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (!constantTimeEquals(expected, hash)) return { ok: false, reason: 'hash mismatch' };

  const authDateSeconds = Number(params.get('auth_date'));
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    return { ok: false, reason: 'missing auth_date' };
  }

  const authDate = new Date(authDateSeconds * 1000);
  const ageSeconds = (now.getTime() - authDate.getTime()) / 1000;
  if (ageSeconds > env.AUTH_INIT_DATA_MAX_AGE_SECONDS) {
    return { ok: false, reason: 'stale auth_date' };
  }

  const rawUser = params.get('user');
  if (!rawUser) return { ok: false, reason: 'missing user' };

  let parsedUser: unknown;
  try {
    parsedUser = JSON.parse(rawUser);
  } catch {
    return { ok: false, reason: 'unparsable user' };
  }

  const user = telegramUserSchema.safeParse(parsedUser);
  if (!user.success) return { ok: false, reason: 'unexpected user shape' };

  return {
    ok: true,
    authDate,
    profile: {
      telegramUserId: user.data.id,
      firstName: user.data.first_name,
      lastName: user.data.last_name ?? null,
      username: user.data.username ?? null,
      photoUrl: user.data.photo_url ?? null,
      languageCode: user.data.language_code ?? null
    }
  };
}

/**
 * Verifies Telegram's Login Widget callback — structurally the same check as
 * `verifyInitData` (data-check string, HMAC, constant-time compare,
 * freshness), but the two are not interchangeable: the widget's secret is
 * `SHA256(bot_token)`, where the Mini App's is
 * `HMAC_SHA256(key: "WebAppData", data: bot_token)`. Using one to verify the
 * other's payload always fails, by design — they're different Telegram
 * products.
 */
export function verifyLoginWidget(
  payload: TelegramWidgetAuthPayload,
  now: Date = new Date()
): InitDataResult {
  const { hash, ...fields } = payload;

  const dataCheckString = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join('\n');

  const secret = crypto.createHash('sha256').update(env.TELEGRAM_BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (!constantTimeEquals(expected, hash)) return { ok: false, reason: 'hash mismatch' };

  const authDate = new Date(payload.auth_date * 1000);
  const ageSeconds = (now.getTime() - authDate.getTime()) / 1000;
  if (ageSeconds > env.AUTH_INIT_DATA_MAX_AGE_SECONDS) {
    return { ok: false, reason: 'stale auth_date' };
  }

  return {
    ok: true,
    authDate,
    profile: {
      telegramUserId: String(payload.id),
      firstName: payload.first_name,
      lastName: payload.last_name ?? null,
      username: payload.username ?? null,
      photoUrl: payload.photo_url ?? null,
      languageCode: null
    }
  };
}

/**
 * `===` on a hash leaks it one byte at a time through response timing: a
 * near-correct guess returns fractionally later than a wrong one.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on a length mismatch, which is itself a leak-free
  // signal: hex hashes are fixed width, so a different length is simply wrong.
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
