import bcrypt from 'bcrypt';
import type {
  EmailLoginPayload,
  EmailRegisterPayload,
  Session,
  SessionUser,
  TelegramWidgetAuthPayload
} from '@bookquest/shared';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { signSessionToken } from '../utils/token.js';
import { verifyInitData, verifyLoginWidget } from '../utils/telegram.js';
import { findParticipantForUser } from './participant.services.js';
import {
  createUserWithEmail,
  findUserByEmail,
  linkTelegramToUser,
  upsertUserFromTelegramProfile
} from './user.services.js';

const INCORRECT_CREDENTIALS = 'Incorrect email or password.';

/**
 * The point every sign-in path converges on, whoever proved who is asking —
 * Telegram's initData, the Login Widget, or an email/password match. From
 * here on there is exactly one answer to "what does signing in mean": mint a
 * token, return the session.
 */
async function issueSession(user: UserDocument): Promise<Session> {
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

  const user = await upsertUserFromTelegramProfile(verified.profile);
  return issueSession(user);
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

  const user = await upsertUserFromTelegramProfile(verified.profile);
  return issueSession(user);
}

/** POST /auth/register */
export async function registerWithEmail(payload: EmailRegisterPayload): Promise<Session> {
  const user = await createUserWithEmail(payload.email, payload.password, payload.firstName);
  return issueSession(user);
}

/**
 * POST /auth/login. The message is identical whether the email doesn't
 * exist or the password is wrong — a different message either way would let
 * a caller enumerate which emails have accounts.
 */
export async function authenticateWithEmail(payload: EmailLoginPayload): Promise<Session> {
  const user = await findUserByEmail(payload.email);

  if (!user || !user.passwordHash) {
    throw ApiError.unauthorized(INCORRECT_CREDENTIALS);
  }

  const matches = await bcrypt.compare(payload.password, user.passwordHash);
  if (!matches) {
    throw ApiError.unauthorized(INCORRECT_CREDENTIALS);
  }

  return issueSession(user);
}

/**
 * POST /auth/telegram/link. Unlike the other three, this doesn't issue a new
 * session — the caller is already signed in — it just returns the updated
 * `SessionUser` so the client can refresh its cache.
 */
export async function linkTelegram(
  user: UserDocument,
  payload: TelegramWidgetAuthPayload
): Promise<SessionUser> {
  const verified = verifyLoginWidget(payload);

  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, 'Rejected Telegram widget sign-in');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  const linked = await linkTelegramToUser(user, verified.profile);
  return toSessionUser(linked);
}

export async function toSessionUser(user: UserDocument): Promise<SessionUser> {
  return {
    id: user.id,
    telegramUserId: user.telegramUserId ?? null,
    email: user.email ?? null,
    firstName: user.firstName,
    username: user.username ?? null,
    photoUrl: user.photoUrl ?? null,
    role: user.role,
    participant: await findParticipantForUser(user)
  };
}
