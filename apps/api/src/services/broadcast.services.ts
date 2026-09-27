import type { Broadcast } from '@bookquest/shared';
import { UserModel } from '../models/user.model.js';
import { BroadcastModel } from '../models/broadcast.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { sendTelegramMessage } from '../utils/telegram-send.js';
import type { UserDocument } from '../models/user.model.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fans out to every `User` that has ever existed — everyone who's ever
 * pressed Start, registered or not (spec's broadcast-audience decision).
 * Sequential with a small delay between sends: Telegram's bot-wide rate
 * limit is roughly 30 messages/second, and this project has no queue to
 * spread the load across — a delay is the entire mitigation it needs at
 * this scale.
 */
export async function sendBroadcast(message: string, createdBy: UserDocument): Promise<Broadcast> {
  const recipients = await UserModel.find({}, { _id: 1, telegramUserId: 1 });

  const broadcast = await BroadcastModel.create({
    message,
    createdBy: createdBy._id,
    recipientCount: recipients.length
  });

  // All Notification rows exist before any DM is attempted: the in-app feed
  // is all-or-nothing for this broadcast, never partial. A DM's own failure
  // (see sendTelegramMessage) still can't touch a row that already exists.
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

  for (const recipient of recipients) {
    // Failure here is logged inside sendTelegramMessage and otherwise
    // ignored — this recipient's Notification row already exists regardless
    // of whether the DM itself landed.
    await sendTelegramMessage(recipient.telegramUserId, message);
    await sleep(35);
  }

  return {
    id: broadcast.id,
    message: broadcast.message,
    recipientCount: broadcast.recipientCount,
    createdAt: broadcast.createdAt.toISOString()
  };
}
