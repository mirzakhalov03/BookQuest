import type { Notification } from '@bookquest/shared';
import { NotificationModel, type NotificationDocument } from '../models/notification.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';

function toDto(notification: NotificationDocument): Notification {
  return {
    id: notification.id,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString()
  };
}

export async function listNotificationsFor(user: UserDocument): Promise<Notification[]> {
  const notifications = await NotificationModel.find({ user: user._id }).sort({ createdAt: -1 });
  return notifications.map(toDto);
}

/**
 * Scoped by `user` in the query itself, not checked after loading — the
 * only way to "load someone else's notification" through this function is
 * for it to not match anything, which reads identically to "no such
 * notification" and leaks nothing about whether the id exists at all.
 */
export async function markNotificationRead(user: UserDocument, id: string): Promise<Notification> {
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: id, user: user._id },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!notification) throw ApiError.notFound('No such notification.');
  return toDto(notification);
}
