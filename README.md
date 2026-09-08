# BookQuest

An annual reading competition. Choose the book, read it before the deadline, take the quiz —
fastest and most accurate win, everyone who finishes gets a certificate.

Runs as a **Telegram Mini App** first, and as a standalone web app second.

## Getting started

```bash
pnpm install
cp .env.example .env          # one .env serves every workspace
# then fill in TELEGRAM_BOT_TOKEN and JWT_SECRET — the API refuses to boot without them
pnpm --filter @bookquest/api seed
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:4000 (`/health`, `/api/v1`)

Requires Node 22+, pnpm 10+, and a MongoDB you can reach at `MONGODB_URI`.

`JWT_SECRET` needs 32+ characters — `openssl rand -hex 32`. `TELEGRAM_BOT_TOKEN` comes from
BotFather; every session is an HMAC keyed by it, so a service without one cannot authenticate
anybody and says so at boot rather than starting up broken. `ADMIN_TELEGRAM_IDS` is the whole admin
model: a comma-separated allowlist, resolved into a role at sign-in and re-read from the database on
every admin request. There is no endpoint that grants a role.

The seed script also runs `syncIndexes()`, which is how a development database picks up index
changes. On a production database, index changes are a deliberate migration step.

## Layout

```
apps/
  web/      Vite + React + Tailwind — the Mini App and the web app
  api/      Express + Mongoose — the HTTP API
packages/
  shared/   Types, zod schemas and the validation rules both sides use
prototype/  The signed-off HTML/CSS design. Open index.html directly.
```

### Why a shared package

The rules for what counts as a real full name, and how a phone number or Telegram username
normalises, live in `packages/shared`. The browser imports them to give instant feedback; the API
imports the same functions so a crafted request cannot get past them. One source of truth, two
callers — the two can never drift.

## The design

`prototype/index.html` is the locked visual direction: the dark stage, the 3D book, the countdown,
the registration title page. Open it in a browser — it needs no build step.

`?view=home&state=quiz` opens any screen and state directly. Press `S` for the state switcher.

The palette, type scale and motion tokens are ported into `apps/web/src/styles/theme.css` as a
Tailwind `@theme` block, so `--color-ember` is both a CSS variable and a `bg-ember` utility.

## Authentication

The Mini App hands the frontend a signed `initData` string. `POST /api/v1/auth/telegram` verifies it
— sorted data-check string, `HMAC(key: "WebAppData", data: BOT_TOKEN)` as the secret, a constant-time
hash comparison, and a freshness window on `auth_date` — then returns a bearer token.

The token carries `{ sub, iat, exp }` and nothing else. No role, no name: every authorization
decision re-reads the user, so removing someone from `ADMIN_TELEGRAM_IDS` takes effect on their next
request rather than whenever their token happens to expire.

Bearer, not a cookie: a Mini App runs in a webview on a Telegram origin, where cross-site cookie
rules are unreliable — and nothing sent automatically by the browser means CSRF is not a category
that applies.

## Conventions

**Backend** — `routes/` → `controllers/` → `services/` → `models/`. Routes wire and validate,
controllers speak HTTP, services hold the logic and return DTOs, models are Mongoose only. Files are
named `*.routes.ts`, `*.controllers.ts`, `*.services.ts`, `*.model.ts`, `*.validators.ts`,
`*.middleware.ts`.

Every response uses one envelope, so the client unwraps in one place:

```jsonc
{ "ok": true,  "data": { } }
{ "ok": false, "error": { "code": "validation_failed", "message": "…", "fields": { } } }
```

**Frontend** — feature-first. Anything belonging to one screen lives under `src/features/<name>/`,
including its queries. Server state is React Query; client state is Zustand. Reusable primitives go
in `components/ui/`.

## What is built

| | |
|---|---|
| ✅ | Monorepo, shared validation, design tokens, API envelope and error handling |
| ✅ | Telegram `initData` verification, bearer sessions, `requireUser` / `requireAdmin`, rate limiting |
| ✅ | Quests: `GET /quests/current`, `GET /quests`, `GET /quests/:edition` |
| ✅ | Participants: register, `/me`, `/me/certificate`, `GET /:number` (session required, no contact) |
| ✅ | Results: `GET /quests/current/results` — ranked once at publication, then frozen |
| ✅ | Admin: participant roster, quest create / edit / make-current, stats |
| 🚧 | Registration and Home as React components — currently stubs; the design is in `prototype/` |
| ⬜ | The quiz. Deliberately unspecified — question delivery, scoring, timing and anti-cheat need their own plan |

Full API contract: the identical section at the end of `BACKEND-SPEC.md` and `FRONTEND-SPEC.md`.
Phase-by-phase status: `BACKEND-PLAN.md`.

> **Linting.** There is no `pnpm lint`. typescript-eslint refuses to load against TypeScript 7
> ([#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)), and a lint script
> that silently passes is worse than none. `pnpm typecheck` is the gate until that lands.

## Scripts

```bash
pnpm dev         # every workspace in watch mode
pnpm build       # shared → api + web
pnpm typecheck   # the CI gate
pnpm --filter @bookquest/api seed
```
