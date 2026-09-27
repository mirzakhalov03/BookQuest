# Phase 3 — Standalone Web Auth & PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The standalone web app (outside Telegram) gets a real sign-in —
Telegram's Login Widget — so registration, profile, results and
notifications all work there, not just as a read-only mirror. The web app
also becomes installable to a phone's home screen.

**Architecture:** A second verification path alongside the existing
`initData` check, converging on the same "issue a session" logic — one
function, two callers, matching how Phase 1 already unified user-upserting.
No change to how Telegram Mini App sign-in works today.

**Tech Stack:** `jose` (already a dependency, used for session JWTs),
Telegram's Login Widget (a `<script>` tag, no npm package), a plain web app
manifest + minimal service worker (no PWA framework).

**Spec:** `docs/superpowers/specs/2026-09-27-bot-miniapp-cooperation-design.md`
(§ "Phase 3 — Standalone web parity & installability")

**Depends on:** Phase 1's `user.services.ts` extraction
(`upsertUserFromTelegramProfile`) — this phase builds one layer on top of it.

## Global Constraints

- No test suite in this repo — verify with `pnpm typecheck` plus the manual
  checks in each task.
- `RequireAuth`/`RequireAdmin` in `apps/web/src/lib/auth/guards.tsx` are
  explicitly documented as UX only — every endpoint re-checks the session
  server-side regardless of how the frontend got there. This phase does not
  change that; the widget flow ends at the same `Session`/bearer-token shape
  the Mini App flow already produces.
- The bot's Telegram **username** (not the token) becomes a public frontend
  env var — it identifies which bot the widget authenticates against, and is
  already public information (anyone can find `@bookquest_bot` in Telegram).
  Never confuse this with `TELEGRAM_BOT_TOKEN`, which stays server-only.

## Review Focus

- **A widget callback with a tampered or missing `hash`** — must be rejected
  the same way a bad `initData` is today (401, generic message, real reason
  only in the server log). Covered in Task 2 and Task 4's manual check.
- **A widget callback with a stale `auth_date`** — Telegram's widget payload
  can be replayed if not time-boxed; must reuse the same freshness window
  `AUTH_INIT_DATA_MAX_AGE_SECONDS` already enforces for Mini App sign-in, not
  a second, drifted constant. Covered in Task 2.
- **Two truly different login paths producing two different session
  shapes** — the whole point of the shared-tail refactor in Task 3 is that a
  widget sign-in and a Mini App sign-in are indistinguishable to everything
  downstream. Covered in Task 3's manual check (compare both responses).
- **The widget script failing to load** (network blip, ad blocker) — the web
  sign-in screen must not be left blank with no explanation. Covered in Task
  6.
- **Installing the PWA without ever visiting over HTTPS** — service workers
  refuse to register outside a secure context (`localhost` is exempted by
  browsers for development, but the tunnel domain is not automatically
  trusted the way `localhost` is unless served over HTTPS, which the ngrok
  tunnel already is). Covered in Task 7's manual check.

---

### Task 1: Shared schema for the widget payload

**Files:**
- Modify: `packages/shared/src/schemas/auth.ts`

**Interfaces:**
- Produces: `telegramWidgetAuthSchema`/`TelegramWidgetAuthPayload`, consumed
  by Task 2 (API verification), Task 4 (API validator) and Task 5 (frontend
  client).

- [ ] **Step 1: Add the schema**

Append to the existing `apps/... packages/shared/src/schemas/auth.ts`
(do not remove `telegramAuthSchema` or `sessionSchema`):

```typescript
/**
 * What Telegram's Login Widget hands back via its callback — individual
 * fields plus a hash, not a raw string like the Mini App's `initData`. The
 * fields Telegram may omit stay optional here and become `null` once turned
 * into a `TelegramProfile` server-side (utils/telegram.ts), the same
 * normalization the bot's payload already does.
 */
export const telegramWidgetAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string()
});

export type TelegramWidgetAuthPayload = z.infer<typeof telegramWidgetAuthSchema>;
```

- [ ] **Step 2: Typecheck and build**

Run: `pnpm --filter @bookquest/shared typecheck && pnpm --filter @bookquest/shared build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/auth.ts
git commit -m "feat(shared): add telegramWidgetAuthSchema"
```

---

### Task 2: `verifyLoginWidget` — the second verification path

**Files:**
- Modify: `apps/api/src/utils/telegram.ts`

**Interfaces:**
- Consumes: `env.TELEGRAM_BOT_TOKEN`, `env.AUTH_INIT_DATA_MAX_AGE_SECONDS`
  (already imported in this file), `TelegramProfile`, `InitDataResult`
  (already defined in this file).
- Produces: `verifyLoginWidget(payload: TelegramWidgetAuthPayload, now?:
  Date): InitDataResult`, consumed by Task 3.

- [ ] **Step 1: Add the function**

Add one import to the existing top-of-file import block in
`apps/api/src/utils/telegram.ts`:

```typescript
import type { TelegramWidgetAuthPayload } from '@bookquest/shared';
```

Then append the function itself below the existing code (`verifyInitData`
and `constantTimeEquals` stay untouched — this reuses `constantTimeEquals`
and the `InitDataResult`/`TelegramProfile` types already in the file):

```typescript
/**
 * Verifies Telegram's Login Widget callback — structurally the same check as
 * `verifyInitData` (data-check string, HMAC, constant-time compare,
 * freshness), but the two are not interchangeable: the widget's secret is
 * `SHA256(bot_token)`, where the Mini App's is
 * `HMAC_SHA256(key: "WebAppData", data: bot_token)`. Using one to verify the
 * other's payload always fails, by design — they're different Telegram
 * products.
 */
export function verifyLoginWidget(
  payload: TelegramWidgetAuthPayload,
  now: Date = new Date()
): InitDataResult {
  const { hash, ...fields } = payload;

  const dataCheckString = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join('\n');

  const secret = crypto.createHash('sha256').update(env.TELEGRAM_BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (!constantTimeEquals(expected, hash)) return { ok: false, reason: 'hash mismatch' };

  const authDate = new Date(payload.auth_date * 1000);
  const ageSeconds = (now.getTime() - authDate.getTime()) / 1000;
  if (ageSeconds > env.AUTH_INIT_DATA_MAX_AGE_SECONDS) {
    return { ok: false, reason: 'stale auth_date' };
  }

  return {
    ok: true,
    authDate,
    profile: {
      telegramUserId: String(payload.id),
      firstName: payload.first_name,
      lastName: payload.last_name ?? null,
      username: payload.username ?? null,
      photoUrl: payload.photo_url ?? null,
      languageCode: null
    }
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check — a forged hash is rejected**

```bash
cd apps/api
node --experimental-strip-types --env-file=../../.env -e "
import('./src/utils/telegram.ts').then(({ verifyLoginWidget }) => {
  const result = verifyLoginWidget({
    id: 1, first_name: 'Test', auth_date: Math.floor(Date.now() / 1000), hash: 'not-a-real-hash'
  });
  console.log(result);
});
"
```

Expected: `{ ok: false, reason: 'hash mismatch' }`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/utils/telegram.ts
git commit -m "feat(api): add verifyLoginWidget for Telegram Login Widget sign-in"
```

---

### Task 3: The shared session-issuing tail

**Files:**
- Modify: `apps/api/src/services/auth.services.ts`

**Interfaces:**
- Consumes: `verifyLoginWidget` (Task 2), `upsertUserFromTelegramProfile`
  (already imported from Phase 1's `user.services.ts`).
- Produces: `authenticateWithTelegramWidget(payload:
  TelegramWidgetAuthPayload): Promise<Session>`, consumed by Task 4.

- [ ] **Step 1: Extract the tail and add the widget entry point**

Replace the whole file with:

```typescript
// apps/api/src/services/auth.services.ts
import type { Session, SessionUser, TelegramWidgetAuthPayload } from '@bookquest/shared';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { signSessionToken } from '../utils/token.js';
import { verifyInitData, verifyLoginWidget } from '../utils/telegram.js';
import { findParticipantForUser } from './participant.services.js';
import { upsertUserFromTelegramProfile } from './user.services.js';
import type { TelegramProfile } from '../utils/telegram.js';

/**
 * The point both entry points converge on. Whichever Telegram product proved
 * who is asking — the Mini App's initData or the Login Widget's callback —
 * from here on there is exactly one answer to "what does signing in mean":
 * upsert the user, mint a token, return the session. Neither path can drift
 * from the other past this line.
 */
async function issueSessionForProfile(profile: TelegramProfile): Promise<Session> {
  const user = await upsertUserFromTelegramProfile(profile);
  const { token, expiresAt } = await signSessionToken(user.id);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: await toSessionUser(user)
  };
}

/** POST /api/v1/auth/telegram — the Mini App's `initData` exchange. */
export async function authenticateWithTelegram(initData: string): Promise<Session> {
  const verified = verifyInitData(initData);

  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, 'Rejected Telegram initData');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  return issueSessionForProfile(verified.profile);
}

/** POST /api/v1/auth/telegram-widget — the standalone web app's sign-in. */
export async function authenticateWithTelegramWidget(
  payload: TelegramWidgetAuthPayload
): Promise<Session> {
  const verified = verifyLoginWidget(payload);

  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, 'Rejected Telegram widget sign-in');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  return issueSessionForProfile(verified.profile);
}

export async function toSessionUser(user: UserDocument): Promise<SessionUser> {
  return {
    id: user.id,
    telegramUserId: user.telegramUserId,
    firstName: user.firstName,
    username: user.username ?? null,
    photoUrl: user.photoUrl ?? null,
    role: user.role,
    participant: await findParticipantForUser(user)
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/auth.services.ts
git commit -m "refactor(api): extract issueSessionForProfile, add widget sign-in"
```

(Task 4 wires this to a route — the manual check that proves both paths
produce identical session shapes happens there, once there's an endpoint to
call.)

---

### Task 4: `POST /api/v1/auth/telegram-widget`

**Files:**
- Modify: `apps/api/src/validators/auth.validators.ts`
- Modify: `apps/api/src/controllers/auth.controllers.ts`
- Modify: `apps/api/src/routes/auth.routes.ts`

**Interfaces:**
- Consumes: `authenticateWithTelegramWidget` (Task 3),
  `telegramWidgetAuthSchema` (Task 1).
- Produces: the live route, consumed by Task 5's frontend client.

- [ ] **Step 1: Validator**

```typescript
// apps/api/src/validators/auth.validators.ts
import { telegramAuthSchema, telegramWidgetAuthSchema } from '@bookquest/shared';

export const telegramAuthBody = telegramAuthSchema;
export const telegramWidgetAuthBody = telegramWidgetAuthSchema;
```

- [ ] **Step 2: Controller**

```typescript
// apps/api/src/controllers/auth.controllers.ts
import type { Request, Response } from 'express';
import type { TelegramAuthPayload, TelegramWidgetAuthPayload } from '@bookquest/shared';
import * as authService from '../services/auth.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';

/** POST /api/v1/auth/telegram */
export async function signInWithTelegram(req: Request, res: Response): Promise<void> {
  const { initData } = req.body as TelegramAuthPayload;
  ok(res, await authService.authenticateWithTelegram(initData));
}

/** POST /api/v1/auth/telegram-widget */
export async function signInWithTelegramWidget(req: Request, res: Response): Promise<void> {
  ok(res, await authService.authenticateWithTelegramWidget(req.body as TelegramWidgetAuthPayload));
}

/** GET /api/v1/auth/me */
export async function getMe(req: Request, res: Response): Promise<void> {
  ok(res, await authService.toSessionUser(currentUser(req)));
}
```

- [ ] **Step 3: Route**

```typescript
// apps/api/src/routes/auth.routes.ts
import { Router } from 'express';
import * as authController from '../controllers/auth.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireUser } from '../middlewares/auth.middleware.js';
import { authRateLimit } from '../middlewares/rate-limit.middleware.js';
import { telegramAuthBody, telegramWidgetAuthBody } from '../validators/auth.validators.js';

export const authRoutes: Router = Router();

authRoutes.post(
  '/telegram',
  authRateLimit,
  validate(telegramAuthBody),
  authController.signInWithTelegram
);

authRoutes.post(
  '/telegram-widget',
  authRateLimit,
  validate(telegramWidgetAuthBody),
  authController.signInWithTelegramWidget
);

authRoutes.get('/me', requireUser, authController.getMe);
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors.

- [ ] **Step 5: Manual check — both paths, side by side**

There is no real widget payload to hand-craft (its `hash` requires the bot
token, which only Telegram's own widget computes client-side) — Task 6's
browser check is what actually proves Task 2's HMAC path. For now, confirm
the route exists and validates:

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/telegram-widget \
  -H "Content-Type: application/json" -d '{}'
```

Expected: `400 validation_failed` (missing required fields) — proves the
route and validator are wired, ahead of Task 6's real end-to-end check.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/validators/auth.validators.ts apps/api/src/controllers/auth.controllers.ts apps/api/src/routes/auth.routes.ts
git commit -m "feat(api): add POST /api/v1/auth/telegram-widget"
```

---

### Task 5: Frontend — the widget's API client call

**Files:**
- Modify: `apps/web/src/lib/auth/authApi.ts`
- Modify: `.env`
- Modify: `.env.example`

**Interfaces:**
- Produces: `loginWithWidget(payload: TelegramWidgetAuthPayload):
  Promise<Session>`, consumed by Task 6.

- [ ] **Step 1: Add the widget login function**

Append to `apps/web/src/lib/auth/authApi.ts` (the existing
`loginWithTelegram`/`reauthenticate` stay untouched — those remain the Mini
App path):

```typescript
import type { TelegramWidgetAuthPayload } from '@bookquest/shared';

/**
 * The standalone web app's sign-in — Telegram's Login Widget calls back with
 * this shape (see `TelegramLoginWidget.tsx`), and the API verifies it with
 * `verifyLoginWidget`, a different check than the Mini App's `initData`.
 * Unlike `loginWithTelegram`, this always has something to send — there is
 * no "outside Telegram" case here, the widget IS the outside-Telegram case.
 */
export async function loginWithWidget(payload: TelegramWidgetAuthPayload): Promise<Session> {
  const session = await api.post<Session>('/auth/telegram-widget', payload);
  storeToken(session);
  return session;
}
```

- [ ] **Step 2: Add the bot's public username**

```bash
cd /Users/mn.afridi/Desktop/BookQuest3
echo "VITE_TELEGRAM_BOT_USERNAME=bookquest_bot" >> .env
```

Add to `.env.example`, near the other `VITE_*` vars:

```
# The bot's public @username (not its token — this is public information,
# needed so Telegram's Login Widget knows which bot to authenticate against).
VITE_TELEGRAM_BOT_USERNAME=
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/auth/authApi.ts .env.example
git commit -m "feat(web): add loginWithWidget and VITE_TELEGRAM_BOT_USERNAME"
```

---

### Task 6: Frontend — the real web sign-in screen

**Files:**
- Create: `apps/web/src/lib/auth/TelegramLoginWidget.tsx`
- Modify: `apps/web/src/lib/auth/guards.tsx`

**Interfaces:**
- Consumes: `loginWithWidget` (Task 5), `authKeys` (`./useAuth.ts`, already
  exported).
- Produces: the `TelegramLoginWidget` component, replacing
  `ContinueInTelegram`'s dead end in `RequireAuth`.

- [ ] **Step 1: The widget component**

```typescript
// apps/web/src/lib/auth/TelegramLoginWidget.tsx
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authKeys } from './useAuth';
import { loginWithWidget } from './authApi';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

interface TelegramWidgetUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

/**
 * Telegram's Login Widget is a `<script>` tag Telegram's own servers render
 * into a button; there is no npm package, and no props to pass it beyond
 * data attributes. `data-onauth` names a *global* function, not a React
 * callback — that impedance is the whole reason this is its own component
 * rather than inline JSX.
 */
export function TelegramLoginWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    if (!BOT_USERNAME) {
      setScriptFailed(true);
      return;
    }

    window.onTelegramAuth = (user: TelegramWidgetUser) => {
      void loginWithWidget(user).then((session) => {
        queryClient.setQueryData(authKeys.me(), session.user);
      });
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    script.onerror = () => setScriptFailed(true);

    containerRef.current?.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      containerRef.current?.replaceChildren();
    };
  }, [queryClient]);

  if (scriptFailed) {
    return (
      <p className="text-sm text-ember">
        Telegram sign-in didn't load. Check your connection and reload the page.
      </p>
    );
  }

  return <div ref={containerRef} />;
}
```

- [ ] **Step 2: Replace `ContinueInTelegram` in `guards.tsx`**

In `apps/web/src/lib/auth/guards.tsx`, replace the `ContinueInTelegram`
function's body (keep its call site in `RequireAuth` — only the rendered
content changes, since Telegram-outside-Mini-App now has a real sign-in
instead of a dead end):

```typescript
import { TelegramLoginWidget } from './TelegramLoginWidget';

// ... replacing the old ContinueInTelegram function:
function ContinueInTelegram() {
  return (
    <Panel label="Sign in">
      <h1 className="type-display text-4xl">Sign in with Telegram</h1>
      <p className="max-w-[34ch] text-paper-dim">
        BookQuest uses your Telegram account to identify you — no password to
        remember.
      </p>
      <TelegramLoginWidget />
    </Panel>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: no errors.

- [ ] **Step 4: Manual check — the real end-to-end sign-in**

This needs `VITE_TELEGRAM_BOT_USERNAME` set (Task 5) and the web app served
over HTTPS — the widget refuses to render its button on a plain HTTP origin
that isn't `localhost`. Open `http://localhost:5173/me` directly in a
regular browser (not through the Telegram tunnel): expected, the sign-in
panel renders Telegram's real "Log in with Telegram" button. Click it,
authorize in the popup Telegram opens, and confirm you land back on
`/me` signed in — check that `GET /api/v1/auth/me` (browser devtools network
tab) returns the same `SessionUser` shape the Mini App flow already
produces, proving this task's Review Focus item.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth/TelegramLoginWidget.tsx apps/web/src/lib/auth/guards.tsx
git commit -m "feat(web): real Telegram Login Widget sign-in for the standalone web app"
```

---

### Task 7: PWA installability

**Files:**
- Create: `apps/web/public/manifest.webmanifest`
- Create: `apps/web/public/sw.js`
- Create: `apps/web/public/icons/icon-192.png` (see Step 1 — a real asset,
  not generated here)
- Create: `apps/web/public/icons/icon-512.png` (same)
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/main.tsx`

**Interfaces:** none — this task is markup, a manifest, and a no-op service
worker; nothing here is imported by other code.

- [ ] **Step 1: Export two real icon files**

This plan can write the manifest and code, but not conjure artwork — export
two PNGs from BookQuest's existing brand assets (the prototype's favicon or
the wordmark, flattened onto the `--color-ember`/`#14100C` background) at
192×192 and 512×512, and save them to:
- `apps/web/public/icons/icon-192.png`
- `apps/web/public/icons/icon-512.png`

- [ ] **Step 2: The manifest**

```json
// apps/web/public/manifest.webmanifest
{
  "name": "BookQuest",
  "short_name": "BookQuest",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#14100C",
  "theme_color": "#14100C",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: A minimal service worker**

Not offline-first caching (explicitly out of scope, spec's non-goals) — just
enough of a fetch handler for install criteria to be met:

```javascript
// apps/web/public/sw.js
// Deliberately does nothing but pass every request straight through.
// Installability requires a registered service worker with a fetch handler;
// it does not require that handler to cache anything. Offline support is
// out of scope (see the design spec's non-goals) — this is not a stub
// waiting to be finished, it is the whole feature.
self.addEventListener('fetch', () => {});
```

- [ ] **Step 4: Link the manifest**

In `apps/web/index.html`, add inside `<head>`, after the existing
`<meta name="theme-color" ...>` line:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

- [ ] **Step 5: Register the service worker**

In `apps/web/src/main.tsx`, add after the existing `initTelegram();` call:

```typescript
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js');
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: no errors (the two new files are plain JSON/JS, not compiled).

- [ ] **Step 7: Manual check**

Serve the web app over HTTPS (the ngrok tunnel from earlier in this
project, or `pnpm --filter @bookquest/web preview` behind any HTTPS
tunnel) and open it in Chrome. Expected: the browser offers an install
prompt (or, in the address bar, an install icon); DevTools → Application →
Manifest shows the parsed manifest with both icons; DevTools → Application →
Service Workers shows it registered and activated. Confirm `localhost`
without a tunnel also registers the service worker (browsers exempt
`localhost` from the secure-context requirement) — this is the Review Focus
item: a plain HTTP tunnel domain (not HTTPS, not `localhost`) must be the
only case where registration silently fails.

- [ ] **Step 8: Commit**

```bash
git add apps/web/public/manifest.webmanifest apps/web/public/sw.js apps/web/public/icons apps/web/index.html apps/web/src/main.tsx
git commit -m "feat(web): PWA manifest and installability"
```

---

### Task 8: Full-phase verification

**Files:** none.

- [ ] **Step 1: Typecheck everything**

Run: `pnpm typecheck`
Expected: all four workspaces pass.

- [ ] **Step 2: Both sign-in paths, once each**

Inside Telegram: confirm the Mini App still signs in exactly as before —
this phase changed shared code (`auth.services.ts`), so a regression here
is the most important thing to catch. Outside Telegram, in a browser: sign
in with the Telegram Login Widget, confirm `/me` loads with your profile,
and confirm an admin account can still reach `/admin` the same way.

- [ ] **Step 3: Install the PWA**

Add the web app to a phone's home screen (through the HTTPS tunnel) and
confirm it opens standalone, no browser chrome.

- [ ] **Step 4: No commit** — verification only.
