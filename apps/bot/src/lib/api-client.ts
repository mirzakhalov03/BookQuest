import type { BotUserUpsertPayload } from '@bookquest/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const UPSERT_TIMEOUT_MS = 5000;

/**
 * The bot's only write path (spec, Approach A) — everything goes through
 * the existing Express API, never a direct database connection. Never throws:
 * recording the profile must not stop the user getting the "open the app"
 * button, and the Mini App's own sign-in records them again anyway.
 */
export async function upsertUser(profile: BotUserUpsertPayload): Promise<void> {
  try {
    const response = await fetch(`${env.API_BASE_URL}/bot/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Service-Token': env.BOT_SERVICE_TOKEN
      },
      body: JSON.stringify(profile),
      signal: AbortSignal.timeout(UPSERT_TIMEOUT_MS)
    });

    if (!response.ok) {
      logger.error(
        { status: response.status, telegramUserId: profile.telegramUserId },
        'Failed to upsert user from bot'
      );
    }
  } catch (error) {
    // Unreachable API, DNS failure, reset connection or the timeout.
    logger.error({ err: error, telegramUserId: profile.telegramUserId }, 'API unreachable from bot');
  }
}

/**
 * Turns Telegraf's `ctx.from` into the shape the API expects. Telegram makes
 * `last_name`, `username` and `language_code` all optional — `undefined`
 * would fail the shared schema's `.nullable()` fields, so every gap becomes
 * an explicit `null` here, once, rather than at every call site.
 */
export function toBotUserUpsertPayload(from: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}): BotUserUpsertPayload {
  return {
    telegramUserId: String(from.id),
    firstName: from.first_name,
    lastName: from.last_name ?? null,
    username: from.username ?? null,
    photoUrl: null,
    languageCode: from.language_code ?? null
  };
}
