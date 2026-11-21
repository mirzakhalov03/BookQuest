import type { Types } from 'mongoose';
import { parseTelegramUsername, type ContactMethod } from '@bookquest/shared';
import { ParticipantModel } from '../models/participant.model.js';
import { UserModel } from '../models/user.model.js';

/**
 * Another account that already joined this quest and whose *verified* Telegram handle
 * matches the typed contact. Only Telegram's own `User.username` counts — a typed contact
 * is free text, so it can never block someone else.
 */
export async function findTelegramOwnerOfContact(
  questId: Types.ObjectId,
  contact: { method: ContactMethod; value: string },
  callerId: Types.ObjectId
): Promise<{ username: string } | null> {
  if (contact.method !== 'telegram') return null;
  const parsed = parseTelegramUsername(contact.value);
  if (!parsed.ok) return null;

  // Safe to build a RegExp from: the parser only lets [A-Za-z0-9_] through.
  const pattern = new RegExp(`^@?${parsed.value.slice(1)}$`, 'i');
  const owners = await UserModel.find({ username: pattern, _id: { $ne: callerId } }, '_id username');
  if (owners.length === 0) return null;

  const registered = await ParticipantModel.findOne(
    { quest: questId, user: { $in: owners.map((owner) => owner._id) } },
    'user'
  );
  const owner = registered && owners.find((o) => o._id.equals(registered.user));
  return owner?.username ? { username: owner.username } : null;
}
