# Phase 2 — Broadcast & Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin can send a broadcast to everyone who has ever used the bot,
from a new screen in the existing admin panel. Every recipient sees it as
both a Telegram DM and an entry in a new Notifications feed inside the Mini
App. The same feed carries individual, system-generated messages too — this
phase only wires the pipe; no system event produces one yet (that arrives
with whatever feature needs it, e.g. certificates).

**Architecture:** One `Notification` model, one row per recipient regardless
of origin. A `Broadcast` fans out into many `Notification`s. Delivery to
Telegram happens directly from `apps/api` (it already holds
`TELEGRAM_BOT_TOKEN`) — `apps/bot` is not involved, matching Phase 1's
Approach A: the bot only ever handles inbound updates.

**Tech Stack:** Same as the rest of the API (Express, Mongoose, Zod) and web
app (React Query, Tailwind) — nothing new introduced.

**Spec:** `docs/superpowers/specs/2026-09-27-bot-miniapp-cooperation-design.md`
(§ "Phase 2 — Broadcast & notifications")

**Depends on:** Phase 1 (`2026-09-27-bot-wiring-and-start.md`) — reuses
`TELEGRAM_BOT_TOKEN` already present in `apps/api`'s env, and the
`upsertUserFromTelegramProfile` split that keeps `User` creation in one
place.

## Global Constraints

- No test suite in this repo — verify with `pnpm typecheck` plus the manual
  checks in each task.
- Every API response uses the existing `ok(res, data)` / `ApiError` envelope.
- `apps/bot` still has no direct database connection (Approach A) — outbound
  Telegram sends in this phase happen from `apps/api` directly, never
  routed through the bot process.
- Telegram's bot-wide `sendMessage` rate limit means fan-out to "everyone"
  must be sequential with pacing, not a burst — see Task 4.
- The participant-facing tab bar (`components/layout/TabBar.tsx`) is
  explicitly described in its own code as design-locked to the prototype's
  five destinations ("the whole of the product knowledge a layout primitive
  is allowed"). This phase does not add a sixth tab — see Task 6 for where
  Notifications actually surfaces instead, and treat that placement as the
  one open judgment call in this plan, easy to relocate later.

## Review Focus

- **A broadcast sent with zero `User` documents in the system** (a fresh
  install before anyone has ever pressed Start) — must create the
  `Broadcast` record with `recipientCount: 0` and send nothing, not throw.
  Covered in Task 3's manual check.
- **One recipient's Telegram send fails mid-fan-out** (blocked the bot,
  deactivated account) — the remaining recipients must still get theirs, and
  their `Notification` row must still exist even though the DM failed.
  Covered in Task 4.
- **Marking someone else's notification as read** — `POST
  /me/notifications/:id/read` must only ever touch a notification owned by
  the calling user, never trust the id alone. Covered in Task 5's manual
  check.
- **The notifications feed for someone with zero notifications** — must
  render an empty state, not an error or an infinite spinner. Covered in
  Task 6.
- **A broadcast message at the validator's length limit and one character
  over it** — the over-limit case must be rejected with a field-level
  message before it ever reaches the fan-out logic. Covered in Task 2.

---

### Task 1: Shared schemas and types

**Files:**
- Create: `packages/shared/src/schemas/notification.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Interfaces:**
- Produces: `notificationSchema`/`Notification` (DTO shape for the feed),
  `createBroadcastSchema`/`CreateBroadcastPayload`, `broadcastSchema`/
  `Broadcast` (DTO shape for admin's sent-history list) — consumed by every
  later task in this phase.

- [ ] **Step 1: Write the schemas**

```typescript
// packages/shared/src/schemas/notification.ts
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
```

- [ ] **Step 2: Export it**

```typescript
// packages/shared/src/schemas/index.ts
// Add:
export * from './notification.js';
```

- [ ] **Step 3: Typecheck and build**

Run: `pnpm --filter @bookquest/shared typecheck && pnpm --filter @bookquest/shared build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/notification.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add notification and broadcast schemas"
```

---

### Task 2: Models — `Notification` and `Broadcast`

**Files:**
- Create: `apps/api/src/models/notification.model.ts`
- Create: `apps/api/src/models/broadcast.model.ts`

**Interfaces:**
- Produces: `NotificationModel`, `BroadcastModel` and their document types,
  consumed by Task 3 and Task 5's services.

- [ ] **Step 1: `Notification`**

```typescript
// apps/api/src/models/notification.model.ts
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
```

- [ ] **Step 2: `Broadcast`**

```typescript
// apps/api/src/models/broadcast.model.ts
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A sent-history record for admin's own list. Participants never read this
 * directly — they read the `Notification` rows it fanned out into.
 */
const broadcastSchema = new Schema(
  {
    message: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientCount: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

broadcastSchema.index({ createdAt: -1 });

export type BroadcastAttributes = InferSchemaType<typeof broadcastSchema>;
export type BroadcastDocument = HydratedDocument<BroadcastAttributes>;
export const BroadcastModel = model('Broadcast', broadcastSchema);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/models/notification.model.ts apps/api/src/models/broadcast.model.ts
git commit -m "feat(api): add Notification and Broadcast models"
```

---

### Task 3: Telegram send helper

**Files:**
- Create: `apps/api/src/utils/telegram-send.ts`

**Interfaces:**
- Consumes: `env.TELEGRAM_BOT_TOKEN` (`../config/env.js`, already exists).
- Produces: `sendTelegramMessage(telegramUserId: string, text: string):
  Promise<boolean>`, consumed by Task 4.

- [ ] **Step 1: Write it**

```typescript
// apps/api/src/utils/telegram-send.ts
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * The API already holds the bot token — for sending, it never needs
 * apps/bot in the loop (Approach A: the bot process handles inbound updates
 * only). Returns whether the send succeeded rather than throwing: one
 * blocked or deactivated recipient must never stop the rest of a fan-out.
 */
export async function sendTelegramMessage(telegramUserId: string, text: string): Promise<boolean> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: telegramUserId, text })
  });

  if (!response.ok) {
    logger.warn({ telegramUserId, status: response.status }, 'Telegram send failed');
  }

  return response.ok;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

```bash
cd apps/api
node --experimental-strip-types --env-file=../../.env -e "
import('./src/utils/telegram-send.ts').then(async ({ sendTelegramMessage }) => {
  const ok = await sendTelegramMessage('<your own telegram user id>', 'Test from telegram-send.ts');
  console.log('sent:', ok);
});
"
```

Expected: `sent: true`, and the message actually arrives in your DM with the
bot.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/utils/telegram-send.ts
git commit -m "feat(api): add sendTelegramMessage helper"
```

---

### Task 4: Admin broadcast — service, controller, route

**Files:**
- Create: `apps/api/src/services/broadcast.services.ts`
- Create: `apps/api/src/controllers/admin/broadcast.controllers.ts`
- Create: `apps/api/src/routes/admin/broadcast.routes.ts`
- Modify: `apps/api/src/routes/admin/index.ts`
- Create: `apps/api/src/validators/admin.validators.ts` addition (append to
  existing file — see Step 3)

**Interfaces:**
- Consumes: `BroadcastModel`, `NotificationModel` (Task 2),
  `sendTelegramMessage` (Task 3), `createBroadcastSchema` (Task 1).
- Produces: `POST /api/v1/admin/broadcasts`, `sendBroadcast(message: string,
  createdBy: UserDocument): Promise<Broadcast>` — consumed by Task 6's
  frontend mutation.

- [ ] **Step 1: The service**

```typescript
// apps/api/src/services/broadcast.services.ts
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
```

- [ ] **Step 2: The controller**

```typescript
// apps/api/src/controllers/admin/broadcast.controllers.ts
import type { Request, Response } from 'express';
import type { CreateBroadcastPayload } from '@bookquest/shared';
import * as broadcastService from '../../services/broadcast.services.js';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ok } from '../../utils/respond.js';

/** POST /api/v1/admin/broadcasts */
export async function createBroadcast(req: Request, res: Response): Promise<void> {
  const { message } = req.body as CreateBroadcastPayload;
  const broadcast = await broadcastService.sendBroadcast(message, currentUser(req));
  ok(res, broadcast, 201);
}
```

- [ ] **Step 3: Validator — append to the existing admin validators file**

Add this export to `apps/api/src/validators/admin.validators.ts` (do not
replace the file's existing exports):

```typescript
import { createBroadcastSchema } from '@bookquest/shared';

export const createBroadcastBody = createBroadcastSchema;
```

- [ ] **Step 4: Route**

```typescript
// apps/api/src/routes/admin/broadcast.routes.ts
import { Router } from 'express';
import * as adminBroadcastController from '../../controllers/admin/broadcast.controllers.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createBroadcastBody } from '../../validators/admin.validators.js';

export const adminBroadcastRoutes: Router = Router();

adminBroadcastRoutes.post('/', validate(createBroadcastBody), adminBroadcastController.createBroadcast);
```

- [ ] **Step 5: Mount it**

In `apps/api/src/routes/admin/index.ts`, add the import and mount line
alongside the existing three:

```typescript
import { adminBroadcastRoutes } from './broadcast.routes.js';
// ...
adminRoutes.use('/broadcasts', adminBroadcastRoutes);
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors.

- [ ] **Step 7: Manual check — including the zero-recipients edge case**

```bash
TOKEN=<a real admin bearer token — sign in through the Mini App and copy it>
curl -s -X POST http://localhost:4000/api/v1/admin/broadcasts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"Quiz opens tomorrow at 6pm!"}'
```

Expected: `{"ok":true,"data":{"id":"...","message":"Quiz opens tomorrow at
6pm!","recipientCount":<N>,"createdAt":"..."}}`, one Telegram DM per
recipient, and one `Notification` document per recipient (check via
`mongosh` or the admin roster). If your database currently has zero `User`
documents, the same call must still return `recipientCount: 0` rather than
erroring — this is the Review Focus item for this task.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/broadcast.services.ts apps/api/src/controllers/admin/broadcast.controllers.ts apps/api/src/routes/admin/broadcast.routes.ts apps/api/src/routes/admin/index.ts apps/api/src/validators/admin.validators.ts
git commit -m "feat(api): add POST /api/v1/admin/broadcasts"
```

---

### Task 5: `GET /me/notifications` and mark-as-read

**Files:**
- Create: `apps/api/src/services/notification.services.ts`
- Create: `apps/api/src/controllers/notification.controllers.ts`
- Create: `apps/api/src/routes/notification.routes.ts`
- Modify: `apps/api/src/routes/index.ts`

**Interfaces:**
- Consumes: `NotificationModel` (Task 2), `currentUser` (existing
  `auth.middleware.ts`).
- Produces: `GET /api/v1/me/notifications`, `POST
  /api/v1/me/notifications/:id/read` — consumed by Task 6's frontend.

- [ ] **Step 1: The service**

```typescript
// apps/api/src/services/notification.services.ts
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
```

- [ ] **Step 2: The controller**

```typescript
// apps/api/src/controllers/notification.controllers.ts
import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';

/** GET /api/v1/me/notifications */
export async function listMine(req: Request, res: Response): Promise<void> {
  ok(res, await notificationService.listNotificationsFor(currentUser(req)));
}

/** POST /api/v1/me/notifications/:id/read */
export async function markRead(req: Request, res: Response): Promise<void> {
  ok(res, await notificationService.markNotificationRead(currentUser(req), req.params.id as string));
}
```

- [ ] **Step 3: The route**

```typescript
// apps/api/src/routes/notification.routes.ts
import { Router } from 'express';
import * as notificationController from '../controllers/notification.controllers.js';
import { requireUser } from '../middlewares/auth.middleware.js';

export const notificationRoutes: Router = Router();

notificationRoutes.get('/', requireUser, notificationController.listMine);
notificationRoutes.post('/:id/read', requireUser, notificationController.markRead);
```

- [ ] **Step 4: Mount it under `/me/notifications`**

```typescript
// apps/api/src/routes/index.ts
import { notificationRoutes } from './notification.routes.js';
// ...
apiRoutes.use('/me/notifications', notificationRoutes);
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors.

- [ ] **Step 6: Manual check — including the cross-user guard**

```bash
TOKEN_A=<user A's bearer token>
TOKEN_B=<user B's bearer token>

# User A lists their own feed (populated by Task 4's broadcast, if you ran it).
curl -s http://localhost:4000/api/v1/me/notifications -H "Authorization: Bearer $TOKEN_A"

# Grab one of A's notification ids from that response, then, as B, try to mark it read:
curl -s -X POST http://localhost:4000/api/v1/me/notifications/<A's notification id>/read \
  -H "Authorization: Bearer $TOKEN_B"
```

Expected: the last call returns `404 not_found` — B cannot mark A's
notification, confirming this task's Review Focus item.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/notification.services.ts apps/api/src/controllers/notification.controllers.ts apps/api/src/routes/notification.routes.ts apps/api/src/routes/index.ts
git commit -m "feat(api): add GET /me/notifications and mark-as-read"
```

---

### Task 6: Frontend — the Notifications feed

**Files:**
- Create: `apps/web/src/features/notifications/api/notificationKeys.ts`
- Create: `apps/web/src/features/notifications/api/useNotifications.ts`
- Create: `apps/web/src/features/notifications/api/useMarkNotificationRead.ts`
- Create: `apps/web/src/features/notifications/NotificationsPage.tsx`
- Modify: `apps/web/src/components/layout/TopBar.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Interfaces:**
- Consumes: `Notification` type (`@bookquest/shared`), `api` client, and the
  existing `LoadingState`/`ErrorState`/`EmptyState` feedback primitives
  every other screen already uses.
- Produces: the `/notifications` route.

**On placement:** the participant tab bar is explicitly locked to the
prototype's five destinations (see this plan's Global Constraints). This
task adds a small unread-count bell to `TopBar` instead — the one chrome
element already present on every screen — rather than touching the tab bar.
This is a judgment call made during planning, not a spec requirement; easy
to move later if it doesn't feel right once you see it.

- [ ] **Step 1: Query keys**

```typescript
// apps/web/src/features/notifications/api/notificationKeys.ts
export const notificationKeys = {
  all: ['notifications'] as const,
  mine: () => [...notificationKeys.all, 'me'] as const
};
```

- [ ] **Step 2: The list query**

```typescript
// apps/web/src/features/notifications/api/useNotifications.ts
import { useQuery } from '@tanstack/react-query';
import type { Notification } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { notificationKeys } from './notificationKeys';

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.mine(),
    queryFn: () => api.get<Notification[]>('/me/notifications')
  });
}
```

- [ ] **Step 3: The mark-as-read mutation**

```typescript
// apps/web/src/features/notifications/api/useMarkNotificationRead.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { notificationKeys } from './notificationKeys';

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<Notification>(`/me/notifications/${id}/read`, undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.mine() });
    }
  });
}
```

- [ ] **Step 4: The screen**

```typescript
// apps/web/src/features/notifications/NotificationsPage.tsx
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatLongDate } from '@/lib/format';
import { useNotifications } from './api/useNotifications';
import { useMarkNotificationRead } from './api/useMarkNotificationRead';

export function NotificationsPage() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

  if (notifications.isPending) return <LoadingState label="Reading notifications…" />;
  if (notifications.error) {
    return <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />;
  }

  if (notifications.data.length === 0) {
    return (
      <Screen>
        <h1 className="type-display text-2xl text-paper">Notifications</h1>
        <EmptyState title="Nothing yet" body="Announcements and updates will show up here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <h1 className="type-display text-2xl text-paper">Notifications</h1>
      <ul className="flex flex-col gap-3">
        {notifications.data.map((notification) => (
          <li
            key={notification.id}
            className={`rounded-[3px] border border-[color:var(--rule)] px-4 py-3 ${
              notification.readAt ? 'opacity-60' : ''
            }`}
            onClick={() => {
              if (!notification.readAt) markRead.mutate(notification.id);
            }}
          >
            <p className="type-label">{formatLongDate(notification.createdAt)}</p>
            <p className="text-paper">{notification.body}</p>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
```

- [ ] **Step 5: A bell in `TopBar`**

In `apps/web/src/components/layout/TopBar.tsx`, add an unread-count query
and a link, alongside the existing `WebLink`:

```typescript
import { NavLink } from 'react-router';
import { useNotifications } from '@/features/notifications/api/useNotifications';
// ... existing imports stay

export function TopBar({ year }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="wordmark">
        <span className="wordmark__name">BookQuest</span>
        {year !== undefined && <span className="wordmark__year">{year}</span>}
      </div>
      <div className="flex items-center gap-3">
        <NotificationsBell />
        <WebLink />
      </div>
    </header>
  );
}

function NotificationsBell() {
  const notifications = useNotifications();
  const unreadCount = notifications.data?.filter((n) => !n.readAt).length ?? 0;

  return (
    <NavLink to="/notifications" aria-label="Notifications" className="relative">
      <span aria-hidden="true">🔔</span>
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-ember px-1 text-xs text-paper">
          {unreadCount}
        </span>
      )}
    </NavLink>
  );
}
```

- [ ] **Step 6: The route**

In `apps/web/src/app/router.tsx`, add the import and a public route (same
level as `/results` — anyone signed in can have notifications, and the
guard on the query itself already means a signed-out visitor just sees an
empty/erroring feed the way every other `requireUser`-backed screen does):

```typescript
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
// ... among the route children:
{ path: '/notifications', element: <NotificationsPage /> },
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: no errors.

- [ ] **Step 8: Manual check**

With `pnpm dev` running and signed in through the Mini App: run Task 4's
broadcast curl again, then reload the app. Expected: the bell in `TopBar`
shows an unread count, tapping it opens `/notifications` and shows the
message, tapping the notification clears its unread state and the bell's
count drops. Also check the zero-notifications case (a fresh account, or
before any broadcast) shows the empty state, not a spinner or error.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/notifications apps/web/src/components/layout/TopBar.tsx apps/web/src/app/router.tsx
git commit -m "feat(web): add the Notifications feed"
```

---

### Task 7: Frontend — Admin Broadcast screen

**Files:**
- Create: `apps/web/src/features/admin/api/useSendBroadcast.ts`
- Create: `apps/web/src/features/admin/BroadcastPage.tsx`
- Modify: `apps/web/src/layouts/AdminLayout.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Interfaces:**
- Consumes: `CreateBroadcastPayload`/`Broadcast` (`@bookquest/shared`), `api`
  client.
- Produces: `/admin/broadcast`.

- [ ] **Step 1: The mutation**

```typescript
// apps/web/src/features/admin/api/useSendBroadcast.ts
import { useMutation } from '@tanstack/react-query';
import type { Broadcast, CreateBroadcastPayload } from '@bookquest/shared';
import { api } from '@/lib/api/client';

export function useSendBroadcast() {
  return useMutation({
    mutationFn: (payload: CreateBroadcastPayload) => api.post<Broadcast>('/admin/broadcasts', payload)
  });
}
```

- [ ] **Step 2: The screen**

```typescript
// apps/web/src/features/admin/BroadcastPage.tsx
import { useState } from 'react';
import { AdminScreen } from '@/layouts/AdminLayout';
import { useSendBroadcast } from './api/useSendBroadcast';

export function BroadcastPage() {
  const [message, setMessage] = useState('');
  const sendBroadcast = useSendBroadcast();

  return (
    <AdminScreen>
      <h1 className="type-display text-2xl text-paper">Broadcast</h1>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!message.trim()) return;
          sendBroadcast.mutate(
            { message },
            { onSuccess: () => setMessage('') }
          );
        }}
      >
        <textarea
          className="min-h-32 rounded-[3px] border border-[color:var(--rule)] bg-[color:var(--color-ash)] p-3 text-paper"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={1000}
          placeholder="Quiz opens tomorrow at 6pm!"
        />
        <button
          type="submit"
          disabled={sendBroadcast.isPending || !message.trim()}
          className="rounded-[3px] bg-ember px-4 py-2 text-paper disabled:opacity-50"
        >
          {sendBroadcast.isPending ? 'Sending…' : 'Send to everyone'}
        </button>
        {sendBroadcast.isSuccess && (
          <p className="text-sm text-taupe">
            Sent to {sendBroadcast.data.recipientCount} people.
          </p>
        )}
        {sendBroadcast.isError && (
          <p className="text-sm text-ember">{sendBroadcast.error.message}</p>
        )}
      </form>
    </AdminScreen>
  );
}
```

- [ ] **Step 3: Add the nav tab**

In `apps/web/src/layouts/AdminLayout.tsx`, add one entry to the existing
`TABS` array (this nav, unlike the participant tab bar, is not
prototype-locked — it already documents itself as "the same product seen
from behind," a plain table-of-screens nav):

```typescript
{ to: '/admin/broadcast', label: 'Broadcast' }
```

- [ ] **Step 4: The route**

In `apps/web/src/app/router.tsx`, add the import and a child route under the
existing `/admin` tree, alongside `results`:

```typescript
import { BroadcastPage } from '@/features/admin/BroadcastPage';
// ...
{ path: 'broadcast', element: <BroadcastPage /> },
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: no errors.

- [ ] **Step 6: Manual check**

Sign in as an admin, open `/admin/broadcast`, send a message, confirm the
"Sent to N people" line appears and — on a non-admin account signed into the
Mini App elsewhere — the notification and Telegram DM both arrive.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/admin/api/useSendBroadcast.ts apps/web/src/features/admin/BroadcastPage.tsx apps/web/src/layouts/AdminLayout.tsx apps/web/src/app/router.tsx
git commit -m "feat(web): add admin Broadcast screen"
```

---

### Task 8: Full-phase verification

**Files:** none.

- [ ] **Step 1: Typecheck everything**

Run: `pnpm typecheck`
Expected: all four workspaces pass.

- [ ] **Step 2: The whole loop, once**

As admin: send a broadcast from `/admin/broadcast`. As a participant (a
different account, or the same one signed in separately): confirm the
Telegram DM arrives, the `TopBar` bell shows an unread count, opening
`/notifications` shows the message, and tapping it clears the unread state.

- [ ] **Step 3: No commit** — verification only.
