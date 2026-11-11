import type { Types } from 'mongoose';
import type { Broadcast, BroadcastList, BroadcastStatus } from '@bookquest/shared';
import { UserModel } from '../models/user.model.js';
import { BroadcastModel, type BroadcastAttributes, type BroadcastDocument } from '../models/broadcast.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { sendTelegramMessage } from '../utils/telegram-send.js';
import { createRateGate } from '../utils/rate-gate.js';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';

const HISTORY_LIMIT = 20;
/** Progress is written every N sends — often enough for a live bar, rare enough not to double the writes. */
const PROGRESS_EVERY = 25;
/** In flight at once: hides Telegram's per-request latency. */
const CONCURRENCY = 10;
/** Under Telegram's ~30 msg/s bot-wide limit, with headroom. */
const MAX_PER_SECOND = 25;

/** Who can be DMed: Telegram linked and not known to have blocked the bot. */
const DM_REACHABLE = { telegramUserId: { $type: 'string' as const }, dmBlockedAt: null };

/**
 * Writes the record and every in-app notification, then answers. DMs go out
 * after the response — at 1,000+ users they take minutes, longer than any
 * proxy will hold a request. The API is a long-running process, so the loop
 * outlives the request; `GET /admin/broadcasts` reports its progress.
 */
export async function sendBroadcast(message: string, createdBy: UserDocument): Promise<Broadcast> {
  const recipients = await UserModel.find({}, { _id: 1, telegramUserId: 1, dmBlockedAt: 1 }).lean();
  const dmTargets = recipients.flatMap((recipient) =>
    recipient.telegramUserId && !recipient.dmBlockedAt ? [recipient.telegramUserId] : []
  );

  const broadcast = await BroadcastModel.create({
    message,
    createdBy: createdBy._id,
    status: 'sending',
    recipientCount: recipients.length,
    dmCount: dmTargets.length
  });

  // Every Notification row exists before any DM is attempted: the in-app feed is all-or-nothing.
  if (recipients.length > 0) {
    await NotificationModel.insertMany(
      recipients.map((recipient) => ({
        user: recipient._id,
        kind: 'broadcast' as const,
        title: 'BookQuest',
        body: message,
        broadcast: broadcast._id
      }))
    );
  }

  // deliver() handles its own errors; this keeps any slip from becoming an unhandled rejection, which kills Node.
  void deliver(broadcast._id, dmTargets, message).catch(() => undefined);
  return toBroadcastDto(broadcast);
}

async function deliver(broadcastId: Types.ObjectId, targets: string[], message: string): Promise<void> {
  const gate = createRateGate(MAX_PER_SECOND);
  const blocked: string[] = [];
  let sentCount = 0;
  let failedCount = 0;
  let next = 0;

  async function sendOne(target: string): Promise<void> {
    await gate.wait();
    let outcome = await sendTelegramMessage(target, message);
    if (outcome.status === 'rate-limited') {
      // Retried once; the pause holds back every worker, not just this one.
      gate.pause(outcome.retryAfterMs);
      await gate.wait();
      outcome = await sendTelegramMessage(target, message);
    }

    if (outcome.status === 'sent') sentCount += 1;
    else failedCount += 1;
    if (outcome.status === 'blocked') blocked.push(target);

    if ((sentCount + failedCount) % PROGRESS_EVERY === 0) {
      await BroadcastModel.updateOne({ _id: broadcastId }, { $set: { sentCount, failedCount } });
    }
  }

  // Each worker pulls the next index; JS is single-threaded, so `next++` can't hand one target out twice.
  async function worker(): Promise<void> {
    while (next < targets.length) await sendOne(targets[next++]!);
  }

  let status: BroadcastStatus = 'sent';
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
  } catch (error) {
    logger.error({ err: error, broadcastId }, 'Broadcast delivery stopped');
    status = 'interrupted';
  }

  await Promise.all([
    BroadcastModel.updateOne(
      { _id: broadcastId },
      { $set: { sentCount, failedCount, status, completedAt: new Date() } }
    ),
    blocked.length > 0 &&
      UserModel.updateMany({ telegramUserId: { $in: blocked } }, { $set: { dmBlockedAt: new Date() } })
  ]).catch((error: unknown) => logger.error({ err: error, broadcastId }, 'Could not record broadcast outcome'));
}

export async function listBroadcasts(): Promise<BroadcastList> {
  const [items, audience, dmAudience] = await Promise.all([
    BroadcastModel.find().sort({ createdAt: -1 }).limit(HISTORY_LIMIT).lean<BroadcastRow[]>(),
    UserModel.countDocuments({}),
    UserModel.countDocuments(DM_REACHABLE)
  ]);
  return { items: items.map(toBroadcastDto), audience, dmAudience };
}

/**
 * A restart kills any delivery loop mid-way; without this its row would say
 * "sending" forever and the admin screen would poll forever. Assumes one API
 * instance — with several, a booting one would mark another's live send.
 */
export async function markInterruptedBroadcasts(): Promise<number> {
  const result = await BroadcastModel.updateMany(
    { status: 'sending' },
    { $set: { status: 'interrupted', completedAt: new Date() } }
  );
  return result.modifiedCount;
}

type BroadcastRow = BroadcastAttributes & { _id: Types.ObjectId; createdAt: Date };

function toBroadcastDto(broadcast: BroadcastRow | BroadcastDocument): Broadcast {
  return {
    id: String(broadcast._id),
    message: broadcast.message,
    status: broadcast.status as BroadcastStatus,
    recipientCount: broadcast.recipientCount,
    dmCount: broadcast.dmCount,
    sentCount: broadcast.sentCount,
    failedCount: broadcast.failedCount,
    createdAt: broadcast.createdAt.toISOString(),
    completedAt: broadcast.completedAt?.toISOString() ?? null
  };
}
