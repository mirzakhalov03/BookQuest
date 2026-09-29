import { z } from 'zod';

export const NOTIFICATION_KINDS = ['broadcast', 'system'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** One row in a participant's Notifications feed. */
export const notificationSchema = z.object({
  id: z.string(),
  kind: z.enum(NOTIFICATION_KINDS),
  title: z.string(),
  body: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string()
});

export type Notification = z.infer<typeof notificationSchema>;

/** One cap, read by the schema and the composer's counter. */
export const BROADCAST_MAX_LENGTH = 1000;

/** What admin submits from the Broadcast screen. */
export const createBroadcastSchema = z.strictObject({
  message: z
    .string()
    .trim()
    .min(1, 'Say something.')
    .max(BROADCAST_MAX_LENGTH, `Keep it under ${BROADCAST_MAX_LENGTH} characters.`)
});

export type CreateBroadcastPayload = z.infer<typeof createBroadcastSchema>;

export const BROADCAST_STATUSES = ['sending', 'sent', 'interrupted'] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

/** One row in admin's sent-broadcast history. Everyone gets it in-app; `dmCount` of them also on Telegram. */
export const broadcastSchema = z.object({
  id: z.string(),
  message: z.string(),
  status: z.enum(BROADCAST_STATUSES),
  recipientCount: z.number().int().nonnegative(),
  dmCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  completedAt: z.string().nullable()
});

export type Broadcast = z.infer<typeof broadcastSchema>;

export interface BroadcastList {
  items: Broadcast[];
  /** Every user: who a broadcast reaches in-app. */
  audience: number;
  /** Users with Telegram linked: who also gets a DM. */
  dmAudience: number;
}
