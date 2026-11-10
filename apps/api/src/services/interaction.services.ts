import type { Types } from 'mongoose';
import type { InteractionInput } from '@bookquest/shared';
import { adminTelegramIds } from '../config/env.js';
import { BotInteractionModel } from '../models/bot-interaction.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { UserModel, type UserAttributes } from '../models/user.model.js';
import { isOnlyDuplicateKeyErrors } from '../utils/mongo.js';
import { isSignal } from './interaction-classify.services.js';
import { isAdmin } from './user.services.js';

/** A reply within this long after a broadcast is read as a reaction to it. */
const BROADCAST_WINDOW_MS = 72 * 60 * 60 * 1000;

type LeanUser = Pick<UserAttributes, 'telegramUserId' | 'role' | 'phoneNumber'> & {
  _id: Types.ObjectId;
};

/** POST /bot/interactions. Idempotent per updateId; returns how many items are now stored. */
export async function recordInteractions(items: InteractionInput[]): Promise<number> {
  const telegramIds = [...new Set(items.map((item) => item.telegramUserId))];
  const users = await UserModel.find(
    { telegramUserId: { $in: telegramIds } },
    { _id: 1, telegramUserId: 1, role: 1, phoneNumber: 1 }
  ).lean<LeanUser[]>();
  const userByTelegramId = new Map(users.map((user) => [user.telegramUserId!, user]));
  const broadcastFor = await recentBroadcastLookup(items, users);

  const docs = items.map((item) => {
    const user = userByTelegramId.get(item.telegramUserId);
    const sentAt = new Date(item.sentAt);
    return {
      ...item,
      sentAt,
      isEdit: item.isEdit ?? false,
      signal: isSignal(item),
      user: user?._id ?? null,
      fromAdmin: adminTelegramIds.has(item.telegramUserId) || (!!user && isAdmin(user)),
      broadcast: user ? broadcastFor(user._id, sentAt) : null
    };
  });

  await applyMembership(items);

  try {
    await BotInteractionModel.insertMany(docs, { ordered: false });
  } catch (error) {
    if (!isOnlyDuplicateKeyErrors(error)) throw error;
  }
  return docs.length;
}

type BroadcastLookup = (userId: Types.ObjectId, sentAt: Date) => Types.ObjectId | null;

/** One query per batch: each person's broadcasts in the window, newest first, matched in memory. */
async function recentBroadcastLookup(
  items: InteractionInput[],
  users: LeanUser[]
): Promise<BroadcastLookup> {
  if (users.length === 0) return () => null;
  const times = items.map((item) => Date.parse(item.sentAt));
  const notes = await NotificationModel.find(
    {
      user: { $in: users.map((user) => user._id) },
      kind: 'broadcast',
      createdAt: {
        $gte: new Date(Math.min(...times) - BROADCAST_WINDOW_MS),
        $lte: new Date(Math.max(...times))
      }
    },
    { user: 1, broadcast: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .lean<{ user: Types.ObjectId; broadcast: Types.ObjectId | null; createdAt: Date }[]>();

  const byUser = new Map<string, typeof notes>();
  for (const note of notes) {
    const key = String(note.user);
    byUser.set(key, [...(byUser.get(key) ?? []), note]);
  }

  return (userId, sentAt) => {
    const at = sentAt.getTime();
    const match = byUser
      .get(String(userId))
      ?.find(
        (note) =>
          note.createdAt.getTime() <= at && note.createdAt.getTime() >= at - BROADCAST_WINDOW_MS
      );
    return match?.broadcast ?? null;
  };
}

/** Block/unblock keeps `dmBlockedAt` true before the next broadcast finds out. Time-guarded so a late retry can't undo a newer state. */
async function applyMembership(items: InteractionInput[]): Promise<void> {
  const latest = new Map<string, InteractionInput>();
  for (const item of items) {
    if (!item.membership) continue;
    const seen = latest.get(item.telegramUserId);
    // ISO-8601 UTC strings order correctly as strings.
    if (!seen || seen.sentAt < item.sentAt) latest.set(item.telegramUserId, item);
  }
  if (latest.size === 0) return;

  await UserModel.bulkWrite(
    [...latest.values()].map((item) => {
      const sentAt = new Date(item.sentAt);
      return item.membership === 'blocked'
        ? {
            updateOne: {
              filter: {
                telegramUserId: item.telegramUserId,
                $or: [{ dmBlockedAt: null }, { dmBlockedAt: { $lt: sentAt } }]
              },
              update: { $set: { dmBlockedAt: sentAt } }
            }
          }
        : {
            updateOne: {
              filter: { telegramUserId: item.telegramUserId, dmBlockedAt: { $lte: sentAt } },
              update: { $set: { dmBlockedAt: null } }
            }
          };
    }),
    { ordered: false }
  );
}
