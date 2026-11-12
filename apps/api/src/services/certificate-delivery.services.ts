import type { Types } from 'mongoose';
import type { CertificateData, CertificateDelivery, CertificateDeliveryStatus } from '@bookquest/shared';
import { env, webAppUrl } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ResultModel } from '../models/result.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { CertificateDeliveryModel } from '../models/certificate-delivery.model.js';
import type { QuestDocument } from '../models/quest.model.js';
import { ApiError } from '../utils/api-error.js';
import { isDuplicateKeyError } from '../utils/mongo.js';
import { createRateGate } from '../utils/rate-gate.js';
import { sendTelegramPhoto } from '../utils/telegram-send.js';
import { renderCertificatePng } from '../certificates/render.js';
import { requireCurrentQuestDocument } from './quest.services.js';
import { ensureRanked } from './result.services.js';
import { buildCertificateData, certificateFileName, countFinishers } from './certificate.services.js';

// Same budget as broadcasts: under Telegram's ~30 msg/s bot-wide limit.
const CONCURRENCY = 10;
const MAX_PER_SECOND = 25;

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' } as const;
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;

type SendError = 'blocked' | 'failed' | 'no_telegram';

function caption(data: CertificateData): string {
  const first = data.fullName.split(' ')[0];
  return data.placing
    ? `${MEDAL[data.placing]} ${first}, you finished ${ORDINAL[data.placing]} in BookQuest ${data.questYear}! Here's your certificate.`
    : `${first}, you finished BookQuest ${data.questYear}. Here's your certificate. Thank you for reading with us!`;
}

function notificationBody(data: CertificateData): string {
  return data.placing
    ? `You finished ${ORDINAL[data.placing]} in BookQuest ${data.questYear}. Your certificate is on your profile.`
    : `Thank you for finishing BookQuest ${data.questYear}. Your certificate is on your profile.`;
}

export async function startCertificateDelivery(startedBy: UserDocument): Promise<CertificateDelivery> {
  if (!env.WEB_APP_URL) {
    throw ApiError.conflict('Set WEB_APP_URL first — every certificate’s QR code and link point to it.', {
      reason: 'web_app_url_missing'
    });
  }

  const quest = await requireCurrentQuestDocument();
  if (new Date() < quest.resultsAt) throw ApiError.conflict('Results are not published yet.', { reason: 'results_not_published' });
  await ensureRanked(quest);

  try {
    // The unique index on quest turns a concurrent second press into a duplicate-key error.
    await CertificateDeliveryModel.findOneAndUpdate(
      { quest: quest._id, status: { $ne: 'sending' } },
      { $set: { status: 'sending', startedBy: startedBy._id, startedAt: new Date(), completedAt: null } },
      { upsert: true }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) throw ApiError.conflict('Certificates are already being sent.', { reason: 'certificates_sending' });
    throw error;
  }

  // deliver() handles its own errors; this keeps a slip from becoming an unhandled rejection.
  void deliver(quest).catch(() => undefined);
  return getDeliveryStatus();
}

async function deliver(quest: QuestDocument): Promise<void> {
  const finishedCount = await countFinishers(quest._id);
  const pending = await ResultModel.find({ quest: quest._id, certificateSentAt: null })
    .select('participant rank certificateCode')
    .lean();
  const participants = await ParticipantModel.find({ _id: { $in: pending.map((row) => row.participant) } })
    .select('number fullName user')
    .lean();
  const users = await UserModel.find({ _id: { $in: participants.map((row) => row.user) } })
    .select('telegramUserId dmBlockedAt')
    .lean();
  const participantById = new Map(participants.map((row) => [String(row._id), row]));
  const userById = new Map(users.map((row) => [String(row._id), row]));

  const gate = createRateGate(MAX_PER_SECOND);
  const blockedUsers: Types.ObjectId[] = [];
  let next = 0;

  async function finish(id: Types.ObjectId, error: SendError | null): Promise<void> {
    await ResultModel.updateOne(
      { _id: id },
      // 'failed' stays pending, so the next press retries it.
      { $set: { certificateSendError: error, certificateSentAt: error === 'failed' ? null : new Date() } }
    );
  }

  async function sendOne(result: (typeof pending)[number]): Promise<void> {
    const participant = participantById.get(String(result.participant));
    if (!participant) return finish(result._id, 'failed');
    const user = userById.get(String(participant.user));
    const data = buildCertificateData({ result, participant, quest, finishedCount });

    // Claim, then write: a crash between the two loses one notification rather than doubling it.
    const claim = await ResultModel.updateOne(
      { _id: result._id, certificateNotifiedAt: null },
      { $set: { certificateNotifiedAt: new Date() } }
    );
    if (claim.modifiedCount === 1 && user) {
      await NotificationModel.create({
        user: user._id,
        kind: 'system',
        title: 'Your certificate is ready',
        body: notificationBody(data)
      });
    }

    if (!user?.telegramUserId) return finish(result._id, 'no_telegram');
    if (user.dmBlockedAt) return finish(result._id, 'blocked');

    const { png } = await renderCertificatePng(data);
    const photo = { png, fileName: certificateFileName(data) };
    const button = { text: 'Open in BookQuest', webAppUrl: `${webAppUrl}/me` };

    await gate.wait();
    let outcome = await sendTelegramPhoto(user.telegramUserId, photo, caption(data), button);
    if (outcome.status === 'rate-limited') {
      // The pause holds back every worker, not just this one.
      gate.pause(outcome.retryAfterMs);
      await gate.wait();
      outcome = await sendTelegramPhoto(user.telegramUserId, photo, caption(data), button);
    }

    if (outcome.status === 'sent') return finish(result._id, null);
    if (outcome.status === 'blocked') {
      blockedUsers.push(user._id);
      return finish(result._id, 'blocked');
    }
    return finish(result._id, 'failed');
  }

  // Each worker pulls the next index; JS is single-threaded, so `next++` can't hand one row out twice.
  async function worker(): Promise<void> {
    while (next < pending.length) await sendOne(pending[next++]!);
  }

  let status: CertificateDeliveryStatus = 'sent';
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  } catch (error) {
    logger.error({ err: error, edition: quest.edition }, 'Certificate delivery stopped');
    status = 'interrupted';
  }

  await Promise.all([
    CertificateDeliveryModel.updateOne({ quest: quest._id }, { $set: { status, completedAt: new Date() } }),
    blockedUsers.length > 0 &&
      UserModel.updateMany({ _id: { $in: blockedUsers } }, { $set: { dmBlockedAt: new Date() } })
  ]).catch((error: unknown) =>
    logger.error({ err: error, edition: quest.edition }, 'Could not record certificate delivery outcome')
  );
  logger.info({ edition: quest.edition, processed: pending.length, status }, 'Certificate delivery finished');
}

// $ifNull: rows written before these fields existed have them *missing*, and in an expression missing ≠ null.
const field = (name: string) => ({ $ifNull: [`$${name}`, null] });
const countWhen = (condition: object) => ({ $sum: { $cond: [condition, 1, 0] } });

interface DeliveryCounts {
  total: number;
  delivered: number;
  inAppOnly: number;
  blocked: number;
  failed: number;
  pending: number;
}

export async function getDeliveryStatus(): Promise<CertificateDelivery> {
  const quest = await requireCurrentQuestDocument();

  const [counts, delivery, pendingRows] = await Promise.all([
    ResultModel.aggregate<DeliveryCounts>([
      { $match: { quest: quest._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          delivered: countWhen({
            $and: [{ $ne: [field('certificateSentAt'), null] }, { $eq: [field('certificateSendError'), null] }]
          }),
          inAppOnly: countWhen({ $eq: [field('certificateSendError'), 'no_telegram'] }),
          blocked: countWhen({ $eq: [field('certificateSendError'), 'blocked'] }),
          failed: countWhen({ $eq: [field('certificateSendError'), 'failed'] }),
          pending: countWhen({ $eq: [field('certificateSentAt'), null] })
        }
      }
    ]),
    CertificateDeliveryModel.findOne({ quest: quest._id }).lean(),
    ResultModel.find({ quest: quest._id, certificateSentAt: null }).select('participant').lean()
  ]);

  const participants = await ParticipantModel.find({ _id: { $in: pendingRows.map((row) => row.participant) } })
    .select('user')
    .lean();
  const pendingReachable = await UserModel.countDocuments({
    _id: { $in: participants.map((row) => row.user) },
    telegramUserId: { $type: 'string' },
    dmBlockedAt: null
  });

  const row = counts[0];
  return {
    status: (delivery?.status as CertificateDeliveryStatus | undefined) ?? 'idle',
    total: row?.total ?? 0,
    delivered: row?.delivered ?? 0,
    inAppOnly: row?.inAppOnly ?? 0,
    blocked: row?.blocked ?? 0,
    failed: row?.failed ?? 0,
    pending: row?.pending ?? 0,
    pendingReachable,
    startedAt: delivery?.startedAt.toISOString() ?? null,
    completedAt: delivery?.completedAt?.toISOString() ?? null
  };
}

/** Boot: a delivery left "sending" by a restart would poll forever. Same single-instance assumption as broadcasts. */
export async function markInterruptedCertificateDeliveries(): Promise<number> {
  const result = await CertificateDeliveryModel.updateMany(
    { status: 'sending' },
    { $set: { status: 'interrupted', completedAt: new Date() } }
  );
  return result.modifiedCount;
}
