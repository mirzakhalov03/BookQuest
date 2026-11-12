/**
 * Contact rules. A participant is reachable either by Telegram username or by
 * phone number; both normalise to a canonical string before storage.
 */

const TELEGRAM_USERNAME = /^[a-z][a-z0-9_]{3,30}[a-z0-9]$/i;

/** Stable ids for each failure, so clients can say it in their own language. */
export type ContactIssue =
  | 'telegram_missing'
  | 'telegram_short'
  | 'telegram_long'
  | 'telegram_format'
  | 'phone_missing'
  | 'phone_short'
  | 'phone_long';

export type ContactResult =
  | { ok: true; value: string }
  | { ok: false; code: ContactIssue; message: string };

export function parseTelegramUsername(raw: string): ContactResult {
  const value = (raw ?? '').trim().replace(/^@+/, '');

  if (!value) return { ok: false, code: 'telegram_missing', message: 'Add the username people find you by on Telegram.' };
  if (value.length < 5) return { ok: false, code: 'telegram_short', message: 'Telegram usernames are at least 5 characters.' };
  if (value.length > 32) return { ok: false, code: 'telegram_long', message: 'That’s longer than a Telegram username can be.' };
  if (!TELEGRAM_USERNAME.test(value)) {
    return {
      ok: false,
      code: 'telegram_format',
      message: 'Usernames use letters, numbers and underscores, starting with a letter.'
    };
  }
  return { ok: true, value: `@${value}` };
}

export function parsePhoneNumber(raw: string): ContactResult {
  const digits = (raw ?? '').replace(/\D/g, '');

  if (!digits) return { ok: false, code: 'phone_missing', message: 'Add a number we can reach you on.' };
  if (digits.length < 9) return { ok: false, code: 'phone_short', message: 'That number looks a few digits short.' };
  if (digits.length > 15) return { ok: false, code: 'phone_long', message: 'That number has a few digits too many.' };

  return { ok: true, value: formatPhone(digits) };
}

/**
 * Uzbek numbers get proper grouping. Every other country keeps its digits
 * exactly as given — inventing groups for an unknown format is worse than
 * showing none.
 */
export function formatPhone(digits: string): string {
  const d = digits.length === 9 && /^[1-9]/.test(digits) ? `998${digits}` : digits;
  return groupUzbek(d) ?? `+${d}`;
}

export function groupUzbek(digits: string): string | null {
  if (!digits.startsWith('998')) return null;

  const rest = digits.slice(3, 12);
  const cuts = [2, 5, 7, 9];
  let out = '+998';
  let prev = 0;

  for (const cut of cuts) {
    if (prev >= rest.length) break;
    out += ` ${rest.slice(prev, cut)}`;
    prev = cut;
  }
  return out.trim();
}
