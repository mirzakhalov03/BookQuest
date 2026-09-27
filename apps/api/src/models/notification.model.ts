import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const NOTIFICATION_KINDS = ['broadcast', 'system'] as const;

/**
 * One row per recipient, regardless of origin — an admin broadcast fans out
 * into many of these, and a future system event (certificate ready, results
 * published) creates the same shape directly. One model, one feed, one API.
 */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    /** Set only for kind: 'broadcast'. Not required — a system notification
        has no broadcast to point at. */
    broadcast: { type: Schema.Types.ObjectId, ref: 'Broadcast', default: null },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// The feed: this person's notifications, newest first.
notificationSchema.index({ user: 1, createdAt: -1 });

export type NotificationAttributes = InferSchemaType<typeof notificationSchema>;
export type NotificationDocument = HydratedDocument<NotificationAttributes>;
export const NotificationModel = model('Notification', notificationSchema);
