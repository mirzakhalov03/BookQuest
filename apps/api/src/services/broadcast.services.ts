import type { Types } from 'mongoose';
import type { Broadcast, BroadcastList, BroadcastStatus } from '@bookquest/shared';
import { UserModel } from '../models/user.model.js';
import { BroadcastModel, type BroadcastDocument } from '../models/broadcast.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { sendTelegramMessage } from '../utils/telegram-send.js';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';

const HISTORY_LIMIT = 20;
/** Progress is written every N sends — often enough for a live bar, rare enough not to double the writes. */
const PROGRESS_EVERY = 25;
/** Telegram's bot-wide limit is ~30 msg/s; this project has no queue, so spacing is the whole mitigation. */
const SEND_SPACING_MS = 35;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Writes the record and every in-app notification, then answers. DMs go out
 * after the response — at 1,000+ users they take minutes, longer than any
 * proxy will hold a request. The API is a long-running process, so the loop
 * outlives the request; `GET /admin/broadcasts` reports its progress.
 */
export async function sendBroadcast(message: string, createdBy: UserDocument): Promise<Broadcast> {
  const recipients = await UserModel.find({}, { _id: 1, telegramUserId: 1 });
  const dmTargets = recipients.flatMap((recipient) => (recipient.telegramUserId ? [recipient.telegramUserId] : []));

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

  void deliver(broadcast._id, dmTargets, message);
  return toBroadcastDto(broadcast);
}

async function deliver(broadcastId: Types.ObjectId, targets: string[], message: string): Promise<void> {
  let sentCount = 0;
  let failedCount = 0;

  try {
    for (const [index, target] of targets.entries()) {
      // sendTelegramMessage never throws for one bad recipient; it reports false.
      if (await sendTelegramMessage(target, message)) sentCount += 1;
      else failedCount += 1;

      if ((index + 1) % PROGRESS_EVERY === 0) {
        await BroadcastModel.updateOne({ _id: broadcastId }, { $set: { sentCount, failedCount } });
      }
      await sleep(SEND_SPACING_MS);
    }
    await BroadcastModel.updateOne(
      { _id: broadcastId },
      { $set: { sentCount, failedCount, status: 'sent', completedAt: new Date() } }
    );
  } catch (error) {
    logger.error({ err: error, broadcastId }, 'Broadcast delivery stopped');
    await BroadcastModel.updateOne(
      { _id: broadcastId },
      { $set: { sentCount, failedCount, status: 'interrupted', completedAt: new Date() } }
    ).catch(() => undefined);
  }
}

export async function listBroadcasts(): Promise<BroadcastList> {
  const [items, audience, dmAudience] = await Promise.all([
    BroadcastModel.find().sort({ createdAt: -1 }).limit(HISTORY_LIMIT),
    UserModel.countDocuments({}),
    UserModel.countDocuments({ telegramUserId: { $type: 'string' } })
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

function toBroadcastDto(broadcast: BroadcastDocument): Broadcast {
  return {
    id: broadcast.id,
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
