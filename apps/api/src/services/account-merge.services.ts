import type { ClientSession, Model, Types } from 'mongoose';
import { logger } from '../config/logger.js';
import { BotInteractionModel } from '../models/bot-interaction.model.js';
import { BroadcastModel } from '../models/broadcast.model.js';
import { CertificateDeliveryModel } from '../models/certificate-delivery.model.js';
import { LoginCodeModel } from '../models/login-code.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { QuestModel } from '../models/quest.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { withTransaction } from '../utils/transaction.js';

// Every plain `ref: 'User'` field outside Participant (handled first) and Quiz.corrections (an array).
const USER_REFS: [Model<any>, string][] = [
  [NotificationModel, 'user'],
  [LoginCodeModel, 'user'],
  [BotInteractionModel, 'user'],
  [QuizAttemptModel, 'user'],
  [QuizAttemptModel, 'voidedBy'],
  [BroadcastModel, 'createdBy'],
  [CertificateDeliveryModel, 'startedBy'],
  [QuizModel, 'createdBy']
];

const MERGE_CONFLICT = 'Both accounts already took the quiz, so they can’t be merged automatically.';

/**
 * Where both accounts joined the same quest, keeps one participant: the one that sat the
 * quiz, else the earlier number. Runs before re-pointing so `quest+user` never collides.
 */
async function resolveParticipantClashes(
  keepId: Types.ObjectId,
  dropId: Types.ObjectId,
  session?: ClientSession
): Promise<string[]> {
  const notes: string[] = [];
  const dropped = await ParticipantModel.find({ user: dropId }).session(session ?? null);

  for (const theirs of dropped) {
    const ours = await ParticipantModel.findOne({ user: keepId, quest: theirs.quest }).session(session ?? null);
    if (!ours) continue;

    const [oursSat, theirsSat] = await Promise.all(
      [ours, theirs].map((p) => QuizAttemptModel.exists({ participant: p._id }).session(session ?? null))
    );
    if (oursSat && theirsSat) throw ApiError.conflict(MERGE_CONFLICT, { reason: 'merge_conflict' });

    const keepTheirs = theirsSat ? true : oursSat ? false : theirs.number < ours.number;
    const loser = keepTheirs ? ours : theirs;
    await ParticipantModel.deleteOne({ _id: loser._id }, { session });
    await QuestModel.updateOne({ _id: loser.quest }, { $inc: { participantCount: -1 } }, { session });
    notes.push(`quest ${String(loser.quest)}: kept #${keepTheirs ? theirs.number : ours.number}, removed #${loser.number}`);
  }
  return notes;
}

/**
 * Folds `drop` into `keep` (the Telegram identity). Only call this when the caller has
 * proven both identities — a session for one and a verified Telegram payload for the other.
 */
export async function mergeUsers(keep: UserDocument, drop: UserDocument): Promise<UserDocument> {
  const merged = await withTransaction(async (session) => {
    const notes = await resolveParticipantClashes(keep._id, drop._id, session);

    await ParticipantModel.updateMany({ user: drop._id }, { $set: { user: keep._id } }, { session });
    for (const [model, field] of USER_REFS) {
      await model.updateMany({ [field]: drop._id }, { $set: { [field]: keep._id } }, { session });
    }
    await QuizModel.updateMany(
      { 'corrections.by': drop._id },
      { $set: { 'corrections.$[c].by': keep._id } },
      { arrayFilters: [{ 'c.by': drop._id }], session }
    );

    const source = await UserModel.findById(drop._id).select('+passwordHash').session(session ?? null);
    // Gone first: the phone number's unique index would reject it on `keep` while `drop` still holds it.
    await UserModel.deleteOne({ _id: drop._id }, { session });

    const target = await UserModel.findById(keep._id).session(session ?? null);
    if (!target) throw ApiError.notFound('That account no longer exists.');
    if (source?.phoneNumber && !target.phoneNumber) target.phoneNumber = source.phoneNumber;
    if (source?.passwordHash && !target.get('passwordHash')) target.set('passwordHash', source.passwordHash);
    if (source?.role === 'admin') target.role = 'admin';
    await target.save({ session });

    logger.info({ kept: target.id, dropped: drop.id, notes }, 'Merged duplicate accounts');
    return target;
  });
  return merged;
}
