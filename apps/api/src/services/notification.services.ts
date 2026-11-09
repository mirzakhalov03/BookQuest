import type { Types } from 'mongoose';
import { NOTIFICATION_FEED_LIMIT, type Notification, type NotificationFeed } from '@bookquest/shared';
import { NotificationModel, type NotificationAttributes } from '../models/notification.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';

type NotificationRow = NotificationAttributes & { _id: Types.ObjectId; createdAt: Date };

function toDto(notification: NotificationRow): Notification {
  return {
    id: String(notification._id),
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString()
  };
}

export async function listNotificationsFor(user: UserDocument): Promise<NotificationFeed> {
  const [items, unreadCount] = await Promise.all([
    NotificationModel.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(NOTIFICATION_FEED_LIMIT)
      .lean<NotificationRow[]>(),
    NotificationModel.countDocuments({ user: user._id, readAt: null })
  ]);
  return { items: items.map(toDto), unreadCount };
}

// Scoped by `user` in the query, so someone else's id reads the same as a missing one.
export async function markNotificationRead(user: UserDocument, id: string): Promise<Notification> {
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: id, user: user._id },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after' }
  ).lean<NotificationRow>();

  if (!notification) throw ApiError.notFound('No such notification.');
  return toDto(notification);
}
