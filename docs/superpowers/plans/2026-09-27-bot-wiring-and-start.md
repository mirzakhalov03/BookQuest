# Phase 1 — Bot Wiring & `/start` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `apps/bot` workspace, wired to the existing Express API as a
thin HTTP client, gives every fresh user a clean `/start` → welcome message →
"Open BookQuest" button → Mini App flow, with no trace of the old bot's
keyboard.

**Architecture:** `apps/bot` (Telegraf, long polling in dev) never touches
MongoDB. Its one write — recording a Telegram profile the moment someone
presses Start — goes through a new internal, service-authenticated endpoint
on the existing Express API (`POST /api/v1/bot/users`). The API's existing
"upsert a User from a Telegram profile" logic is extracted into a shared
service function so both the Mini App's real login and the bot's `/start`
call the same code, never two copies of it.

**Tech Stack:** Telegraf 4.x, Express, Mongoose, Zod — all already in this
repo's other workspaces; nothing new introduced except Telegraf itself.

**Spec:** `docs/superpowers/specs/2026-09-27-bot-miniapp-cooperation-design.md`
(§ "Phase 1 — Bot wiring, clean slate, `/start` → open the Mini App")

## Global Constraints

- One `.env` at the repo root serves every workspace (`README.md`) — new
  vars go there and in `.env.example`, not in a per-app env file.
- `apps/bot` has **no direct database connection** — Approach A from the
  spec. Every write is an HTTP call to `apps/api`.
- TypeScript strict mode project-wide (`tsconfig.base.json`): `strict`,
  `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`. Code
  that doesn't satisfy these fails `pnpm typecheck`, the project's only gate.
- Every API response uses the existing envelope (`ok(res, data)` /
  `ApiError`) — never a bare `res.json(...)`.
- This repo has **no test suite** (`README.md`: "There is no `pnpm lint`...
  `pnpm typecheck` is the gate") and the user's own stated preference is not
  to add one. Every task below verifies with `pnpm typecheck` plus a concrete
  manual check (`curl`, or an actual Telegram message), not a test file.
- Telegram's `reply_markup` on one message is one of `InlineKeyboardMarkup`
  **or** `ReplyKeyboardRemove` — never both. Clearing the old bot's keyboard
  and offering the new inline "Open BookQuest" button cannot happen in a
  single message; Task 7 sends two.

## Review Focus

- **Double `/start`, or a bot restart mid-conversation** — the upsert must
  stay idempotent (same Telegram user → same `User` document, no duplicate,
  no error). Covered in Task 7's manual check.
- **A Telegram profile missing optional fields** (`last_name`, `username`,
  `language_code` are all optional in Telegram's own API) — the payload
  builder must turn `undefined` into `null`, not send `undefined` and fail
  validation. Covered in Task 6 and its manual check.
- **`POST /api/v1/bot/users` called with a missing or wrong service
  token** — must answer 401 and write nothing, the same way a forged
  Telegram sign-in does today. Covered in Task 4's manual check.
- **The "Open BookQuest" button pointing at a non-HTTPS or unreachable
  URL** — Telegram silently refuses to open a `web_app` button that isn't
  HTTPS. Covered in Task 9's manual check (the button is checked against the
  real tunnel URL, not `localhost`).
- **A user who already has the old bot's custom keyboard on screen** — after
  this phase ships, their *next* interaction must actually clear it, not
  just stop adding to it. Covered in Task 7's manual check.

---

### Task 1: Shared schema for the bot's user-upsert payload

**Files:**
- Create: `packages/shared/src/schemas/bot.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Interfaces:**
- Produces: `botUserUpsertSchema: ZodType`, `BotUserUpsertPayload` (type),
  consumed by Task 3 (API validator) and Task 6 (bot's API client).

- [ ] **Step 1: Write the schema**

```typescript
// packages/shared/src/schemas/bot.ts
import { z } from 'zod';

/**
 * What the bot sends when it records someone on /start. Deliberately
 * narrower than a full Telegram profile: a chat command's `ctx.from` never
 * carries a photo, so `photoUrl` is always null here — it is filled in
 * later, whenever this person actually opens the Mini App and signs in for
 * real.
 */
export const botUserUpsertSchema = z.object({
  telegramUserId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  photoUrl: z.string().nullable(),
  languageCode: z.string().nullable()
});

export type BotUserUpsertPayload = z.infer<typeof botUserUpsertSchema>;
```

- [ ] **Step 2: Export it**

```typescript
// packages/shared/src/schemas/index.ts
// Add this line among the existing export * from './...' lines:
export * from './bot.js';
```

- [ ] **Step 3: Typecheck and build**

Run: `pnpm --filter @bookquest/shared typecheck && pnpm --filter @bookquest/shared build`
Expected: both succeed with no errors (this package has no other consumers
yet touching this file, so nothing else can fail).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/bot.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add botUserUpsertSchema"
```

---

### Task 2: Extract user-upsert into its own service, reused by auth

**Files:**
- Create: `apps/api/src/services/user.services.ts`
- Modify: `apps/api/src/services/auth.services.ts:1-40`

**Interfaces:**
- Consumes: `adminTelegramIds` (`../config/env.js`), `UserModel`
  (`../models/user.model.js`), `TelegramProfile` (`../utils/telegram.js`) —
  all already exist, unchanged.
- Produces: `upsertUserFromTelegramProfile(profile: TelegramProfile):
  Promise<UserDocument>`, consumed by Task 4 (bot controller) and by this
  task's own edit to `auth.services.ts`.

- [ ] **Step 1: Create the shared upsert function**

```typescript
// apps/api/src/services/user.services.ts
import { adminTelegramIds } from '../config/env.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { TelegramProfile } from '../utils/telegram.js';

/**
 * The one place a Telegram profile becomes a `User` row. Both a real sign-in
 * (`auth.services.ts`, verified `initData`) and the bot's `/start` (verified
 * only by the service token — see `bot-service.middleware.ts`) call this, so
 * there is exactly one answer to "what does upserting a user mean" no matter
 * which side triggered it.
 */
export async function upsertUserFromTelegramProfile(
  profile: TelegramProfile
): Promise<UserDocument> {
  const role = adminTelegramIds.has(profile.telegramUserId) ? 'admin' : 'participant';

  return UserModel.findOneAndUpdate(
    { telegramUserId: profile.telegramUserId },
    {
      $set: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: profile.username,
        photoUrl: profile.photoUrl,
        languageCode: profile.languageCode,
        role,
        lastSeenAt: new Date()
      }
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
}
```

- [ ] **Step 2: Make `auth.services.ts` call it instead of inlining it**

In `apps/api/src/services/auth.services.ts`, replace the body of
`authenticateWithTelegram` from the role/upsert block down through the
`UserModel.findOneAndUpdate` call with a call to the new function. The
result:

```typescript
// apps/api/src/services/auth.services.ts
import type { Session, SessionUser } from '@bookquest/shared';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { signSessionToken } from '../utils/token.js';
import { verifyInitData } from '../utils/telegram.js';
import { findParticipantForUser } from './participant.services.js';
import { upsertUserFromTelegramProfile } from './user.services.js';

export async function authenticateWithTelegram(initData: string): Promise<Session> {
  const verified = verifyInitData(initData);

  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, 'Rejected Telegram initData');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  const user = await upsertUserFromTelegramProfile(verified.profile);
  const { token, expiresAt } = await signSessionToken(user.id);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: await toSessionUser(user)
  };
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

Note what disappeared: the `adminTelegramIds` import (no longer used
directly here) and the inline `$set` block. Remove the now-unused
`adminTelegramIds` import from this file — `noUnusedLocals` will fail the
build otherwise.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors. If `adminTelegramIds` still shows as unused-import,
the removal in Step 2 was missed.

- [ ] **Step 4: Manual check — existing login still works**

With `pnpm dev` running (all workspaces), open the Mini App in a browser at
`http://localhost:5173` (or through the tunnel, if that's still up) and
confirm sign-in still succeeds and `/me` returns your profile — this is the
existing flow, now running through the extracted function; a regression here
means Step 2 changed behavior, not just location.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/user.services.ts apps/api/src/services/auth.services.ts
git commit -m "refactor(api): extract upsertUserFromTelegramProfile into user.services.ts"
```

---

### Task 3: `BOT_SERVICE_TOKEN` env var and the `requireBotService` middleware

**Files:**
- Modify: `apps/api/src/config/env.ts:8-30`
- Create: `apps/api/src/middlewares/bot-service.middleware.ts`

**Interfaces:**
- Produces: `env.BOT_SERVICE_TOKEN: string`, `requireBotService:
  RequestHandler`, consumed by Task 4's route.

- [ ] **Step 1: Add the env var to the schema**

In `apps/api/src/config/env.ts`, add this field to `envSchema`, next to
`JWT_SECRET` (same shape — a long shared secret, not a per-user value):

```typescript
  /** Shared secret only `apps/bot` holds. It authenticates the bot process
      itself, not a person — there is no Telegram initData to verify for a
      service call. Generate with: openssl rand -hex 32 */
  BOT_SERVICE_TOKEN: z.string().min(32, 'BOT_SERVICE_TOKEN must be at least 32 characters'),
```

- [ ] **Step 2: Write the middleware**

```typescript
// apps/api/src/middlewares/bot-service.middleware.ts
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

/**
 * Authenticates `apps/bot` itself, not a person signed in through it. A
 * single shared header, checked on every call — the bot equivalent of
 * requireUser/requireAdmin, but there is no session to resolve because the
 * caller isn't a browser and never will produce a signed initData string.
 */
export const requireBotService: RequestHandler = (req, _res, next) => {
  const token = req.header('X-Bot-Service-Token');
  if (!token || token !== env.BOT_SERVICE_TOKEN) {
    next(ApiError.unauthorized('Not allowed.'));
    return;
  }
  next();
};
```

- [ ] **Step 3: Add the value to `.env` and `.env.example`**

Generate a real value and append it to `/Users/mn.afridi/Desktop/BookQuest3/.env`:

```bash
cd /Users/mn.afridi/Desktop/BookQuest3
echo "BOT_SERVICE_TOKEN=$(openssl rand -hex 32)" >> .env
```

Add the documented, blank placeholder to `.env.example`, near
`TELEGRAM_BOT_TOKEN`:

```
# Shared secret only apps/bot holds — authenticates the bot process itself,
# not a person. Generate with: openssl rand -hex 32
BOT_SERVICE_TOKEN=
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors.

- [ ] **Step 5: Manual check — API still boots**

Run: `pnpm --filter @bookquest/api dev` (or restart the full `pnpm dev`) and
confirm the log line `BookQuest API listening on http://localhost:4000`
still appears — a missing or too-short `BOT_SERVICE_TOKEN` would instead
throw `Invalid environment configuration` at boot, per how `env.ts` already
behaves for every other required var.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/src/middlewares/bot-service.middleware.ts .env.example
git commit -m "feat(api): add BOT_SERVICE_TOKEN and requireBotService middleware"
```

(`.env` itself is git-ignored — nothing to add there.)

---

### Task 4: `POST /api/v1/bot/users`

**Files:**
- Create: `apps/api/src/validators/bot.validators.ts`
- Create: `apps/api/src/controllers/bot.controllers.ts`
- Create: `apps/api/src/routes/bot.routes.ts`
- Modify: `apps/api/src/routes/index.ts`

**Interfaces:**
- Consumes: `botUserUpsertSchema` (Task 1), `requireBotService` (Task 3),
  `upsertUserFromTelegramProfile` (Task 2).
- Produces: the live route, consumed by Task 6 (bot's API client).

- [ ] **Step 1: Validator**

```typescript
// apps/api/src/validators/bot.validators.ts
import { botUserUpsertSchema } from '@bookquest/shared';

/** Request-shaped wrapper around the shared rule. */
export const botUserUpsertBody = botUserUpsertSchema;
```

- [ ] **Step 2: Controller**

```typescript
// apps/api/src/controllers/bot.controllers.ts
import type { Request, Response } from 'express';
import type { BotUserUpsertPayload } from '@bookquest/shared';
import * as userService from '../services/user.services.js';
import { ok } from '../utils/respond.js';

/** POST /api/v1/bot/users — called only by apps/bot, never by a browser. */
export async function upsertUser(req: Request, res: Response): Promise<void> {
  const profile = req.body as BotUserUpsertPayload;
  const user = await userService.upsertUserFromTelegramProfile(profile);
  ok(res, { id: user.id });
}
```

- [ ] **Step 3: Route**

```typescript
// apps/api/src/routes/bot.routes.ts
import { Router } from 'express';
import * as botController from '../controllers/bot.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireBotService } from '../middlewares/bot-service.middleware.js';
import { botUserUpsertBody } from '../validators/bot.validators.js';

export const botRoutes: Router = Router();

botRoutes.post('/users', requireBotService, validate(botUserUpsertBody), botController.upsertUser);
```

- [ ] **Step 4: Mount it**

```typescript
// apps/api/src/routes/index.ts
import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { questRoutes } from './quest.routes.js';
import { participantRoutes } from './participant.routes.js';
import { adminRoutes } from './admin/index.js';
import { botRoutes } from './bot.routes.js';

export const apiRoutes: Router = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/quests', questRoutes);
apiRoutes.use('/participants', participantRoutes);
apiRoutes.use('/admin', adminRoutes);
apiRoutes.use('/bot', botRoutes);

// Coming later: /quiz
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: no errors.

- [ ] **Step 6: Manual check — the route, both ways**

With the API running:

```bash
# No token: must be rejected.
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/v1/bot/users \
  -H "Content-Type: application/json" \
  -d '{"telegramUserId":"1","firstName":"Test","lastName":null,"username":null,"photoUrl":null,"languageCode":null}'
# Expected: 401

# Correct token: must succeed.
TOKEN=$(grep '^BOT_SERVICE_TOKEN=' .env | cut -d= -f2-)
curl -s -X POST http://localhost:4000/api/v1/bot/users \
  -H "Content-Type: application/json" -H "X-Bot-Service-Token: $TOKEN" \
  -d '{"telegramUserId":"999999","firstName":"Test","lastName":null,"username":null,"photoUrl":null,"languageCode":null}'
# Expected: {"ok":true,"data":{"id":"<some id>"}}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/validators/bot.validators.ts apps/api/src/controllers/bot.controllers.ts apps/api/src/routes/bot.routes.ts apps/api/src/routes/index.ts
git commit -m "feat(api): add POST /api/v1/bot/users"
```

---

### Task 5: Scaffold the `apps/bot` workspace

**Files:**
- Create: `apps/bot/package.json`
- Create: `apps/bot/tsconfig.json`
- Create: `apps/bot/src/config/env.ts`
- Create: `apps/bot/src/config/logger.ts`

**Interfaces:**
- Produces: `env` (parsed config, including `WEB_APP_URL`,
  `TELEGRAM_BOT_TOKEN`, `API_BASE_URL`, `BOT_SERVICE_TOKEN`), `logger` —
  consumed by every later task in this workspace.

pnpm's workspace glob (`pnpm-workspace.yaml`: `apps/*`) and turbo's pipeline
(`turbo.json`: generic `dev`/`build`/`typecheck` tasks keyed by script name,
not by package) both already cover any new `apps/*` package automatically —
neither file needs editing for this task.

- [ ] **Step 1: `package.json`**

```json
{
  "name": "@bookquest/bot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/bot.js",
  "scripts": {
    "dev": "tsx watch --env-file-if-exists=../../.env src/bot.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node --env-file-if-exists=../../.env dist/bot.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@bookquest/shared": "workspace:*",
    "telegraf": "^4.16.3",
    "pino": "^10.3.1"
  },
  "devDependencies": {
    "@types/node": "^26.5.0",
    "pino-pretty": "^13.1.3",
    "tsx": "^4.23.13",
    "typescript": "^7.0.2"
  }
}
```

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "types": ["node"],
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Env schema**

```typescript
// apps/bot/src/config/env.ts
import { z } from 'zod';

/**
 * Parsed once, at boot, the same discipline `apps/api` uses — nothing
 * downstream reads `process.env` directly.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** The same BotFather token apps/api uses to verify initData — this
      process uses it to receive updates and send messages instead. */
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),

  /** Shared secret proving this process, not a browser, is calling the API. */
  BOT_SERVICE_TOKEN: z.string().min(32, 'BOT_SERVICE_TOKEN is required'),

  /** Where apps/api lives. No trailing slash. */
  API_BASE_URL: z.string().url().default('http://localhost:4000/api/v1'),

  /** The Mini App's URL — what the "Open BookQuest" button opens. Telegram
      refuses a web_app button that isn't HTTPS, so in local dev this must be
      the tunnel URL, not localhost. */
  WEB_APP_URL: z.string().url('WEB_APP_URL is required and must be a URL')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${detail}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
```

- [ ] **Step 4: Logger**

```typescript
// apps/bot/src/config/logger.ts
import pino from 'pino';
import { env, isProduction } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } }
});
```

- [ ] **Step 5: Install and typecheck**

Run: `pnpm install && pnpm --filter @bookquest/bot typecheck`
Expected: install succeeds; typecheck currently has nothing to check yet
beyond these two files, so it passes trivially.

- [ ] **Step 6: Commit**

```bash
git add apps/bot/package.json apps/bot/tsconfig.json apps/bot/src/config/env.ts apps/bot/src/config/logger.ts pnpm-lock.yaml
git commit -m "feat(bot): scaffold apps/bot workspace"
```

---

### Task 6: The bot's API client

**Files:**
- Create: `apps/bot/src/lib/api-client.ts`

**Interfaces:**
- Consumes: `env` (Task 5), `BotUserUpsertPayload` (`@bookquest/shared`,
  Task 1).
- Produces: `upsertUser(profile: BotUserUpsertPayload): Promise<void>`,
  consumed by Task 7's `/start` handler.

- [ ] **Step 1: Write the client**

```typescript
// apps/bot/src/lib/api-client.ts
import type { BotUserUpsertPayload } from '@bookquest/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * The bot's only write path (spec, Approach A) — everything goes through
 * the existing Express API, never a direct database connection.
 */
export async function upsertUser(profile: BotUserUpsertPayload): Promise<void> {
  const response = await fetch(`${env.API_BASE_URL}/bot/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bot-Service-Token': env.BOT_SERVICE_TOKEN
    },
    body: JSON.stringify(profile)
  });

  if (!response.ok) {
    // Recording the profile failing must never stop the user from getting
    // the "open the app" button — the Mini App's own sign-in records them
    // again anyway. Log it and move on rather than throwing into ctx.reply.
    logger.error(
      { status: response.status, telegramUserId: profile.telegramUserId },
      'Failed to upsert user from bot'
    );
  }
}

/**
 * Turns Telegraf's `ctx.from` into the shape the API expects. Telegram makes
 * `last_name`, `username` and `language_code` all optional — `undefined`
 * would fail the shared schema's `.nullable()` fields, so every gap becomes
 * an explicit `null` here, once, rather than at every call site.
 */
export function toBotUserUpsertPayload(from: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}): BotUserUpsertPayload {
  return {
    telegramUserId: String(from.id),
    firstName: from.first_name,
    lastName: from.last_name ?? null,
    username: from.username ?? null,
    photoUrl: null,
    languageCode: from.language_code ?? null
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @bookquest/bot typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check — the `undefined` → `null` mapping**

This has no bot wired up yet to call it through Telegram, so check it
directly:

```bash
cd apps/bot
node --experimental-strip-types -e "
import('./src/lib/api-client.ts').then(({ toBotUserUpsertPayload }) => {
  console.log(toBotUserUpsertPayload({ id: 42, first_name: 'Ada' }));
});
"
```

Expected output has `lastName: null, username: null, languageCode: null` —
not `undefined` anywhere, which is what would fail the shared schema once
this payload reaches the API in Task 7.

- [ ] **Step 4: Commit**

```bash
git add apps/bot/src/lib/api-client.ts
git commit -m "feat(bot): add API client for recording users"
```

---

### Task 7: `/start`, the fallback handler, and a clean command menu

**Files:**
- Create: `apps/bot/src/handlers/start.ts`
- Create: `apps/bot/src/handlers/fallback.ts`
- Create: `apps/bot/src/bot.ts`

**Interfaces:**
- Consumes: `upsertUser`, `toBotUserUpsertPayload` (Task 6), `env`, `logger`
  (Task 5).
- Produces: the running bot process — this is the phase's main deliverable.

- [ ] **Step 1: The `/start` handler**

```typescript
// apps/bot/src/handlers/start.ts
import { Markup, type Context } from 'telegraf';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { toBotUserUpsertPayload, upsertUser } from '../lib/api-client.js';

const WELCOME =
  'Welcome to BookQuest! 📚\n\n' +
  'An annual reading competition — pick the book, read it, take the quiz. ' +
  'Speed and accuracy decide the winners, and everyone who finishes gets a ' +
  'certificate.';

/**
 * Two messages, not one: Telegram's reply_markup is either an inline
 * keyboard or a "remove the old keyboard" instruction, never both on the
 * same message. The first message clears whatever the old bot left on
 * screen; the second carries the one action that matters.
 */
export async function handleStart(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  await upsertUser(toBotUserUpsertPayload(ctx.from));

  await ctx.reply(WELCOME, Markup.removeKeyboard());
  await ctx.reply(
    'Tap below to get started.',
    Markup.inlineKeyboard([[Markup.button.webApp('📖 Open BookQuest', env.WEB_APP_URL)]])
  );

  logger.info({ telegramUserId: String(ctx.from.id) }, 'Handled /start');
}
```

- [ ] **Step 2: The fallback handler**

```typescript
// apps/bot/src/handlers/fallback.ts
import { Markup, type Context } from 'telegraf';
import { env } from '../config/env.js';

/**
 * Everything the old bot's keyboard used to do now lives in the Mini App.
 * Any text that isn't /start gets pointed at the one button that matters,
 * rather than a dead command.
 */
export async function handleFallback(ctx: Context): Promise<void> {
  await ctx.reply(
    'Everything happens inside the app now.',
    Markup.inlineKeyboard([[Markup.button.webApp('📖 Open BookQuest', env.WEB_APP_URL)]])
  );
}
```

- [ ] **Step 3: The entry point**

```typescript
// apps/bot/src/bot.ts
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { handleStart } from './handlers/start.js';
import { handleFallback } from './handlers/fallback.js';

async function start(): Promise<void> {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  // Clears the old bot's "/" command menu. Idempotent — safe on every boot.
  await bot.telegram.setMyCommands([]);

  // Registration order matters: /start must be seen before the generic text
  // handler below, or Telegraf would run both for the same message.
  bot.start(handleStart);
  bot.on(message('text'), handleFallback);

  bot.catch((error, ctx) => {
    logger.error({ error, updateType: ctx.updateType }, 'Unhandled bot error');
  });

  await bot.launch();
  logger.info('BookQuest bot listening (long polling)');

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    bot.stop(signal);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to start');
  process.exit(1);
});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @bookquest/bot typecheck`
Expected: no errors.

- [ ] **Step 5: Manual check — talk to it for real**

This is the phase's real acceptance check, and needs `WEB_APP_URL` set to a
live HTTPS URL — reuse the ngrok web tunnel from earlier in this project (or
start a fresh one: `ngrok http 5173`), and set `WEB_APP_URL` in `.env` to
that tunnel's URL before running this.

```bash
pnpm --filter @bookquest/bot dev
```

In Telegram, open your chat with `@bookquest_bot` and:
1. Send `/start` twice in a row. Expected: two clean welcome/button
   exchanges, no error in the bot's log, and (checked via `mongosh` or the
   admin panel) still exactly one `User` document for your Telegram id —
   confirms the idempotent-upsert Review Focus item.
2. If your account still shows the old bot's custom keyboard from before
   this phase, confirm it is gone after this `/start` — confirms the
   clean-slate Review Focus item.
3. Send some arbitrary text, e.g. "hello". Expected: the fallback reply with
   the same button.
4. Tap "Open BookQuest". Expected: the Mini App opens, loaded from the
   tunnel URL.

- [ ] **Step 6: Commit**

```bash
git add apps/bot/src/handlers/start.ts apps/bot/src/handlers/fallback.ts apps/bot/src/bot.ts
git commit -m "feat(bot): /start, fallback handler, clean command menu"
```

---

### Task 8: Mini App boot polish — fullscreen and closing confirmation

**Files:**
- Modify: `apps/web/src/lib/telegram.ts`

**Interfaces:**
- Modifies: `initTelegram()` (no signature change) and the internal
  `TelegramWebApp` interface (adds three optional methods).

- [ ] **Step 1: Extend the interface and `initTelegram`**

In `apps/web/src/lib/telegram.ts`, add these three optional members to the
`TelegramWebApp` interface (next to the existing `setHeaderColor` /
`setBackgroundColor`):

```typescript
  requestFullscreen?: () => void;
  isFullscreen?: boolean;
  enableClosingConfirmation?: () => void;
```

Then extend `initTelegram()`:

```typescript
export function initTelegram(): void {
  const webApp = getTelegramWebApp();
  if (!webApp) return;

  webApp.ready();
  webApp.expand();
  // Newer clients support a real fullscreen request; expand() above is the
  // fallback every client understands. There is no feature-detection beyond
  // "does the method exist" — older clients simply don't have it.
  webApp.requestFullscreen?.();
  // The platform's actual ceiling for "hard to dismiss": Telegram has no API
  // to block the swipe-down/back-gesture close, only to ask for confirmation
  // before it happens.
  webApp.enableClosingConfirmation?.();
  webApp.setHeaderColor?.('#14100C');
  webApp.setBackgroundColor?.('#14100C');
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Open the Mini App inside Telegram Desktop (via the tunnel, as before) and
confirm: it fills the whole window (no visible Telegram chrome above it),
and swiping/clicking to close it shows a confirmation prompt rather than
closing immediately. On a Telegram client too old to support
`requestFullscreen`/`enableClosingConfirmation`, confirm the app still opens
normally — these are optional-chained, so an old client simply skips them.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/telegram.ts
git commit -m "feat(web): fullscreen + closing confirmation on Mini App boot"
```

---

### Task 9: Wire the real env values and update the docs

**Files:**
- Modify: `.env`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:** none — configuration and documentation only.

- [ ] **Step 1: Set `WEB_APP_URL` for real in `.env`**

`apps/api`'s schema already has this var (optional there); `apps/bot`
requires it (Task 5). Set it to your current tunnel URL:

```bash
# Replace with whatever ngrok (or your tunnel of choice) is currently serving 5173 at.
sed -i '' 's|^# WEB_APP_URL=.*|WEB_APP_URL=https://your-current-tunnel.ngrok-free.app|' .env
```

If the line is commented out or absent, add it directly instead of using
`sed`.

- [ ] **Step 2: Document the two new vars in `.env.example`**

Uncomment and generalize the existing `WEB_APP_URL` line's comment (it's
no longer bot-messages-only) and confirm `BOT_SERVICE_TOKEN` (added in Task
3) reads clearly:

```
# Absolute URL of the web app. Required by apps/bot (the "Open BookQuest"
# button) and used by apps/api for certificate links. Must be HTTPS for
# Telegram to accept it as a Mini App URL.
WEB_APP_URL=
```

- [ ] **Step 3: Update `README.md`'s "Layout" and "What is built" sections**

Add a line to the `apps/` tree in "Layout":

```
  bot/      Telegraf — the Telegram bot: /start, and (later) admin broadcast
```

And in the "What is built" table, change the quiz-adjacent row's neighbor —
add a new row:

```
| ✅ | Bot: `/start` records the user and opens the Mini App |
```

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md
git commit -m "docs: document WEB_APP_URL and apps/bot in README"
```

(`.env` is git-ignored, matching every other secret in this project — no
commit for it.)

---

### Task 10: Full-phase verification

**Files:** none — this task changes nothing; it confirms Tasks 1–9 work
together.

- [ ] **Step 1: Typecheck everything**

Run: `pnpm typecheck`
Expected: `4 successful, 4 total` (shared, api, web, bot).

- [ ] **Step 2: Boot everything**

Run: `pnpm dev`
Expected: all four workspaces start clean — `shared` compiles, `api` logs
"MongoDB connected" and "listening on http://localhost:4000", `web` logs
Vite's ready message, `bot` logs "BookQuest bot listening (long polling)".

- [ ] **Step 3: The whole loop, once, end to end**

With a tunnel pointing at `5173` and `WEB_APP_URL` set to it (Task 9):
message `@bookquest_bot`, send `/start`, tap "Open BookQuest", and confirm
the Mini App opens fullscreen inside Telegram Desktop. This is the phase's
stated goal from the brainstorm — a fresh user becomes a `/start` clicker
and Mini App opener, nothing else.

- [ ] **Step 4: No commit** — this task is verification only.
