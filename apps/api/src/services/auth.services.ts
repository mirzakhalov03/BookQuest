import type { Session, SessionUser, TelegramWidgetAuthPayload } from '@bookquest/shared';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { signSessionToken } from '../utils/token.js';
import { verifyInitData, verifyLoginWidget } from '../utils/telegram.js';
import { findParticipantForUser } from './participant.services.js';
import { upsertUserFromTelegramProfile } from './user.services.js';
import type { TelegramProfile } from '../utils/telegram.js';

/**
 * The point both entry points converge on. Whichever Telegram product proved
 * who is asking — the Mini App's initData or the Login Widget's callback —
 * from here on there is exactly one answer to "what does signing in mean":
 * upsert the user, mint a token, return the session. Neither path can drift
 * from the other past this line.
 */
async function issueSessionForProfile(profile: TelegramProfile): Promise<Session> {
  const user = await upsertUserFromTelegramProfile(profile);
  const { token, expiresAt } = await signSessionToken(user.id);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: await toSessionUser(user)
  };
}

/** POST /api/v1/auth/telegram — the Mini App's `initData` exchange. */
export async function authenticateWithTelegram(initData: string): Promise<Session> {
  const verified = verifyInitData(initData);

  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, 'Rejected Telegram initData');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  return issueSessionForProfile(verified.profile);
}

/** POST /api/v1/auth/telegram-widget — the standalone web app's sign-in. */
export async function authenticateWithTelegramWidget(
  payload: TelegramWidgetAuthPayload
): Promise<Session> {
  const verified = verifyLoginWidget(payload);

  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, 'Rejected Telegram widget sign-in');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  return issueSessionForProfile(verified.profile);
}

export async function toSessionUser(user: UserDocument): Promise<SessionUser> {
  return {
    id: user.id,
    telegramUserId: user.telegramUserId,
    firstName: user.firstName,
    username: user.username ?? null,
    photoUrl: user.photoUrl ?? null,
    role: user.role,
    participant: await findParticipantForUser(user)
  };
}
