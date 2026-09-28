import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import {
  parsePhoneNumber,
  parseTelegramUsername,
  type Session,
  type TelegramCodeChallenge
} from '@bookquest/shared';
import { env } from '../config/env.js';
import { LoginCodeModel } from '../models/login-code.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { sendTelegramMessage } from '../utils/telegram-send.js';
import { issueSession } from './auth.services.js';
import { findCurrentQuestDocument } from './quest.services.js';

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

const REG_NUMBER = /^#?\d{1,4}$/;
const USERNAME_LIKE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

const NO_MATCH = "We couldn't find anyone with that.";
const EXPIRED = 'That code expired. Send a new one.';

const hashCode = (code: string): string =>
  createHmac('sha256', env.LOGIN_CODE_SECRET).update(code).digest('hex');

// Both sides are fixed-length hex digests, so the lengths always match.
const codeMatches = (hash: string, code: string): boolean =>
  timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashCode(code), 'hex'));

function invalidIdentifier(message: string): ApiError {
  return ApiError.badRequest(message, { identifier: message });
}

const userIds = (
  users: { id: string }[],
  participants: { user: { toString(): string } }[]
): string[] => [...new Set([...users.map((u) => u.id), ...participants.map((p) => p.user.toString())])];

/** Every user id the identifier could mean. Contacts span all editions, so older participants still match. */
async function findCandidateUserIds(identifier: string): Promise<string[]> {
  const raw = identifier.trim();

  if (REG_NUMBER.test(raw)) {
    const quest = await findCurrentQuestDocument();
    if (!quest) return [];
    const participant = await ParticipantModel.findOne(
      { quest: quest._id, number: Number(raw.replace('#', '')) },
      'user'
    );
    return participant ? [participant.user.toString()] : [];
  }

  if (raw.startsWith('@') || USERNAME_LIKE.test(raw)) {
    const parsed = parseTelegramUsername(raw);
    if (!parsed.ok) throw invalidIdentifier(parsed.message);
    // Safe to build a RegExp from: the parser only lets [A-Za-z0-9_] through.
    const pattern = new RegExp(`^@?${parsed.value.slice(1)}$`, 'i');
    const [users, participants] = await Promise.all([
      UserModel.find({ username: pattern }, '_id'),
      ParticipantModel.find({ 'contact.method': 'telegram', 'contact.value': pattern }, 'user')
    ]);
    return userIds(users, participants);
  }

  const phone = parsePhoneNumber(raw);
  if (!phone.ok) throw invalidIdentifier(phone.message);
  const digits = phone.value.replace(/\D/g, '');
  const [users, participants] = await Promise.all([
    // Phone accounts store what the login form accepted: with or without the `+`.
    UserModel.find({ phoneNumber: { $in: [`+${digits}`, digits] } }, '_id'),
    ParticipantModel.find({ 'contact.method': 'phone', 'contact.value': phone.value }, 'user')
  ]);
  return userIds(users, participants);
}

async function resolveLoginUser(identifier: string): Promise<UserDocument & { telegramUserId: string }> {
  const ids = await findCandidateUserIds(identifier);

  if (ids.length === 0) throw ApiError.notFound(NO_MATCH);
  // A shared family phone — guessing whose Telegram gets the code would be worse than asking.
  if (ids.length > 1) {
    throw ApiError.conflict('That matches more than one person — try your reg number or @username.');
  }

  const user = await UserModel.findById(ids[0]);
  if (!user) throw ApiError.notFound(NO_MATCH);
  if (!user.telegramUserId) {
    throw ApiError.unprocessable("That account isn't connected to Telegram — log in with your password.");
  }
  return user as UserDocument & { telegramUserId: string };
}

function maskUsername(username: string | null | undefined): string {
  return username ? `@${username.slice(0, 3)}…` : 'your Telegram';
}

/** POST /auth/telegram-code/request */
export async function requestLoginCode(identifier: string): Promise<TelegramCodeChallenge> {
  const user = await resolveLoginUser(identifier);

  // Stops anyone from flooding another person's Telegram with codes.
  const recent = await LoginCodeModel.exists({
    user: user._id,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) }
  });
  if (recent) throw ApiError.tooManyRequests('Wait a minute before asking for another code.');

  // One live code per person: asking again retires the old one.
  await LoginCodeModel.deleteMany({ user: user._id });

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const loginCode = await LoginCodeModel.create({
    user: user._id,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS)
  });

  const sent = await sendTelegramMessage(
    user.telegramUserId,
    `Your BookQuest login code: ${code}. It expires in 10 minutes. If you didn't ask for this, ignore this message.`
  );
  if (!sent) {
    await loginCode.deleteOne();
    throw ApiError.unprocessable(
      "We couldn't reach your Telegram. Open the BookQuest bot in Telegram, tap Start, then try again."
    );
  }

  return { challengeId: loginCode.id, sentTo: maskUsername(user.username) };
}

/** POST /auth/telegram-code/verify */
export async function verifyLoginCode(challengeId: string, code: string): Promise<Session> {
  if (!isValidObjectId(challengeId)) throw ApiError.gone(EXPIRED);

  // Count the attempt before comparing, atomically, so parallel guesses can't slip past the cap.
  const loginCode = await LoginCodeModel.findOneAndUpdate(
    { _id: challengeId, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  );
  if (!loginCode) throw ApiError.gone(EXPIRED);

  if (!codeMatches(loginCode.codeHash, code)) {
    const left = MAX_ATTEMPTS - loginCode.attempts;
    if (left <= 0) {
      await loginCode.deleteOne();
      throw ApiError.gone(EXPIRED);
    }
    const message = `That code isn't right — ${left} ${left === 1 ? 'try' : 'tries'} left.`;
    throw ApiError.badRequest(message, { code: message });
  }

  // Single use.
  await loginCode.deleteOne();

  const user = await UserModel.findById(loginCode.user);
  if (!user) throw ApiError.gone(EXPIRED);
  return issueSession(user);
}
