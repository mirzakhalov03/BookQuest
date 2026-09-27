import type { Session, SessionUser } from '@bookquest/shared';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { signSessionToken } from '../utils/token.js';
import { verifyInitData } from '../utils/telegram.js';
import { findParticipantForUser } from './participant.services.js';
import { upsertUserFromTelegramProfile } from './user.services.js';

/**
 * The only way to obtain a session. Everything about who the caller is comes
 * from Telegram's signature — nothing in the request body is trusted, including
 * the user object inside initData, which is only believed because the HMAC
 * covers it.
 */
export async function authenticateWithTelegram(initData: string): Promise<Session> {
  const verified = verifyInitData(initData);

  if (!verified.ok) {
    // The reason is for us. The caller gets a flat 401.
    logger.warn({ reason: verified.reason }, 'Rejected Telegram initData');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  const user = await upsertUserFromTelegramProfile(verified.profile);
  const { token, expiresAt } = await signSessionToken(user.id);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: await toSessionUser(user)
  };
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
