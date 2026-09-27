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

/** What admin submits from the Broadcast screen. */
export const createBroadcastSchema = z.strictObject({
  message: z.string().trim().min(1, 'Say something.').max(1000, 'Keep it under 1000 characters.')
});

export type CreateBroadcastPayload = z.infer<typeof createBroadcastSchema>;

/** One row in admin's sent-broadcast history. */
export const broadcastSchema = z.object({
  id: z.string(),
  message: z.string(),
  recipientCount: z.number().int().nonnegative(),
  createdAt: z.string()
});

export type Broadcast = z.infer<typeof broadcastSchema>;
