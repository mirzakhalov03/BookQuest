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

  for (const recipient of recipients) {
    await NotificationModel.create({
      user: recipient._id,
      kind: 'broadcast',
      title: 'BookQuest',
      body: message,
      broadcast: broadcast._id
    });

    // Failure here is logged inside sendTelegramMessage and otherwise
    // ignored — the Notification row above already exists regardless, so
    // this person still sees it in the Mini App even if the DM didn't land.
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
