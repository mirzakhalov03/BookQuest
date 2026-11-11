# Certificates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every finisher gets a certificate image with their name. The top three get a tier that shows their place. The bot delivers it, `/me` shows and downloads it, and anyone can verify it at `/verify/:code`. The visual design stays a **placeholder** until the organiser provides one (spec §8).

**Architecture:** `CertificateData` gains `placing` / `tier` / `finishedCount` / `imageUrl` / `verifyUrl` and loses `rank`. The API renders a PNG on demand: a JSX template → `satori` (SVG) → `@resvg/resvg-js` (PNG, 2246 × 1588), with fonts from `@fontsource`, a QR code from `qrcode`, and an in-process LRU. Public routes serve verification JSON and the PNG by code. Any edition works, rate-limited. An organiser presses **Send certificates** on `/admin/results`. A background loop, reusing the broadcast rate gate, writes one in-app notification per finisher and DMs each reachable person the PNG via `sendPhoto`. Progress is bookkept on `Result` (`certificateSentAt`, `certificateSendError`, `certificateNotifiedAt`) plus one `CertificateDelivery` row per quest. The web app replaces the HTML/print certificate with the image, a Download button (Telegram `downloadFile`, falling back to `openLink`), and Share. It adds a public `/verify` screen and a Certificates panel on the admin Results page.

**Tech Stack:** Express 5 + TypeScript (NodeNext), Mongoose 9, Zod 4, satori, @resvg/resvg-js, qrcode, @fontsource/archivo + @fontsource/noto-sans; React + Vite + Tailwind, React Query, React Router, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-10-certificates-design.md`

## Global Constraints

- **The visual design is not part of this plan.** Task 3 ships a deliberately plain placeholder template. Swapping in the organiser's design later touches only `apps/api/src/certificates/template.tsx` and `TEMPLATE_VERSION` (spec §8).
- **A podium place is shown only on the podium.** Nothing outside the leaderboard ever exposes `rank` ≥ 4. The public verify route never returns score, duration, rank or contact.
- **No names in logs.** Certificate code, result id, quest edition and counts only. That covers render errors, send outcomes and request logs.
- **Nobody is sent the same certificate twice under normal operation.** Delivery is resumable: a second press only picks up `certificateSentAt: null`. The one accepted exception, a crash between a successful Telegram send and the database write, is bounded by the concurrency (≤ 10 people) and is listed under Review Focus.
- Telegram ids are **strings** everywhere.
- Per the user's CLAUDE.md, **no automated tests**. Each task is verified with `pnpm typecheck` plus the manual and `curl` checks it lists.
- Backend naming: `*.routes.ts`, `*.controllers.ts`, `*.services.ts`, `*.middleware.ts`, `*.model.ts`. Comments are one-liners explaining *why*.
- Commits end with the `Co-Authored-By` / `Claude-Session` trailers from the session. Stage only the files each task names.

## Review Focus

1. **Missing fields in aggregation.** Results written before this change have no `certificateSentAt` at all. In `find`, `{ certificateSentAt: null }` matches a missing field, but in an aggregation **expression** `{ $eq: ['$certificateSentAt', null] }` is **false** for a missing field. Every `$cond` in `getDeliveryStatus` wraps the field in `$ifNull: [..., null]`. Task 5 Step 10 checks the counts against a seeded quest whose rows predate the fields.
2. **Satori needs WOFF, not WOFF2, and only fonts it was given.** Fontsource ships both. `render.ts` loads the `.woff` files explicitly. Cyrillic comes from Noto Sans through the `fontFamily` fallback list. Task 3 Step 8 renders the `cyrillic` sample and checks there are no tofu boxes.
3. **The public preview could be used to forge certificates.** It renders **fixed sample data only** (no `name` parameter), stamped `SAMPLE` with the code `SAMPLE`. Task 3 Step 8 confirms an unknown sample key is a 400.
4. **One delivery per quest at a time.** The claim is an upsert on `CertificateDelivery` filtered by `status: { $ne: 'sending' }`, with a unique index on `quest`. A second concurrent press fails the insert on the unique index and becomes `409`. Task 5 Step 10 fires two POSTs at once.
5. **Crash window.** After `sendPhoto` succeeds, `certificateSentAt` is written. A crash between the two re-sends that photo on the next press. At most `CONCURRENCY` (10) people are affected. This is accepted: the alternative, claiming before sending, would silently skip those people. The in-app notification has no such window, because `certificateNotifiedAt` is claimed with a conditional update **before** the insert.
6. **Express 5 path syntax.** `/:code/image.png` and `/preview/:tier.png` rely on path-to-regexp v8 treating `.` as a literal after a parameter name. Task 4 Step 9 requests both with `curl`. Also, `/preview/...` is registered **before** `/:code`.
7. **`<img>` can't send a Bearer token.** The previews are therefore public sample images, not an admin route. That differs from spec §4, and the reason is listed under refinements below.
8. **resvg is a native binary.** `@resvg/resvg-js` ships per-platform optional dependencies, not a postinstall script, so pnpm 10's build-script blocking doesn't affect it. Task 3 Step 8 renders once on the deploy target's OS (the Docker/host image), not only on a dev laptop.

---

## File Structure

```
packages/shared/src/schemas/result.ts                     mod   — tiers, certificateTier, normalizeCertificateCode, CertificateData, delivery DTO

apps/api/package.json                                     mod   — satori, @resvg/resvg-js, qrcode, react, @fontsource/*; seed:results script
apps/api/tsconfig.json                                    mod   — "jsx": "react-jsx"
apps/api/src/config/env.ts                                mod   — webAppUrl helper + production warning
apps/api/src/certificates/samples.ts                      new   — fixed preview data (gold…participant, long, cyrillic)
apps/api/src/certificates/template.tsx                    new   — PLACEHOLDER template (replaced by the real design later)
apps/api/src/certificates/render.ts                       new   — fonts, QR, satori → resvg, LRU, TEMPLATE_VERSION
apps/api/src/models/result.model.ts                       mod   — certificateSentAt, certificateSendError, certificateNotifiedAt
apps/api/src/models/certificate-delivery.model.ts         new   — one row per quest
apps/api/src/services/result.services.ts                  mod   — export ensureRanked/requirePublished; certificate code moves out
apps/api/src/services/certificate.services.ts             new   — buildCertificateData, for user, by code, image
apps/api/src/services/certificate-delivery.services.ts    new   — start, deliver loop, status, boot recovery
apps/api/src/services/broadcast.services.ts               mod   — use utils/rate-gate
apps/api/src/utils/rate-gate.ts                           new   — createRateGate + sleep (moved out of broadcast)
apps/api/src/utils/telegram-send.ts                       mod   — sendTelegramPhoto; shared outcome parsing
apps/api/src/middlewares/rate-limit.middleware.ts         mod   — certificateRateLimit
apps/api/src/validators/certificate.validators.ts         new   — code + sample params
apps/api/src/controllers/certificate.controllers.ts       new   — public JSON, image, preview
apps/api/src/controllers/result.controllers.ts            mod   — getMyCertificate reads certificate.services
apps/api/src/controllers/admin/certificate.controllers.ts new   — send, delivery status
apps/api/src/routes/certificate.routes.ts                 new   — public
apps/api/src/routes/admin/certificate.routes.ts           new
apps/api/src/routes/index.ts                              mod   — mount /certificates
apps/api/src/routes/admin/index.ts                        mod   — mount /certificates
apps/api/src/server.ts                                    mod   — mark interrupted deliveries at boot
apps/api/src/scripts/seed-results.ts                      new   — dev-only fake finishers

apps/web/src/assets/certificates/{gold,silver,bronze,participant}.svg   new — mock placeholders
apps/web/src/lib/telegram.ts                              mod   — downloadFile bridge
apps/web/src/lib/api/mock/people.ts                       mod   — buildCertificate → new shape
apps/web/src/lib/api/mock/routes.ts                       mod   — /certificates/:code, admin delivery
apps/web/src/features/profile/components/Certificate.tsx  mod   — image + Download + Share (HTML version removed)
apps/web/src/styles/results.css                           mod   — delete certificate + print CSS
apps/web/src/styles/profile.css                           mod   — .certificate-image
apps/web/src/features/verify/VerifyPage.tsx               new
apps/web/src/features/verify/api/useVerifiedCertificate.ts new
apps/web/src/app/router.tsx                               mod   — /verify, /verify/:code
apps/web/src/features/admin/api/adminKeys.ts              mod   — certificateDelivery key
apps/web/src/features/admin/api/useCertificateDelivery.ts new   — status (polls while sending) + send mutation
apps/web/src/features/admin/certificates/previewUrl.ts    new
apps/web/src/features/admin/certificates/CertificatesPanel.tsx new
apps/web/src/features/admin/ResultsInspectionPage.tsx     mod   — mount the panel

.env.example                                              mod   — WEB_APP_URL note
docs/BACKEND-SPEC.md, docs/FRONTEND-SPEC.md               mod   — CertificateData contract + new endpoints
```

Small refinements over the spec, same behaviour:
- **No new `API_PUBLIC_URL`.** `PUBLIC_API_URL` / `publicApiUrl` already exist in `env.ts` (built for cover URLs), and `imageUrl` uses them.
- **`WEB_APP_URL` is not required at boot,** because that would break local dev. Starting a delivery returns `409` without it, and production logs a config warning. `verifyUrl` falls back to `http://localhost:5173` in dev.
- **The verify route returns the same `CertificateData`** as `/me`, rather than a second "public" type. Nothing in it is private (no rank, score or contact). The spec's "same response time on a miss" is dropped: the status code already says whether a code exists, so equalising timing would hide nothing.
- **Previews are public sample images** at `GET /certificates/preview/:sample.png`, not `GET /admin/certificates/preview?tier=`. An `<img>` can't carry the admin Bearer token, and fixed sample data stamped `SAMPLE` is harmless. Sample keys: `gold`, `silver`, `bronze`, `participant`, `long`, `cyrillic`.
- **A failed DM is retried by pressing Send again.** `certificateSendError: 'failed'` leaves `certificateSentAt` null. `blocked` and `no_telegram` set it, because retrying those is pointless.
- **Notification idempotency** uses `Result.certificateNotifiedAt`, claimed with a conditional update before the insert, instead of a unique key on `Notification`.
- **`normalizeCertificateCode` lives in `@bookquest/shared`,** so the API lookup and the web verify form accept the same messy input (`bq4k7m2qx`, `BQ4 K7M2QX`).

---

### Task 1: Shared contract

**Files:**
- Modify: `packages/shared/src/schemas/result.ts`

**Interfaces:**
- Produces: `CERTIFICATE_TIERS`, `CertificateTier`, `CertificatePlacing`, `certificateTier(rank)`, `normalizeCertificateCode(raw)`, `certificateDataSchema` / `CertificateData` (new shape), `CERTIFICATE_DELIVERY_STATUSES`, `certificateDeliverySchema` / `CertificateDelivery`.

- [ ] **Step 1: Replace the `certificateDataSchema` block** (from the `/** Everything a certificate is rendered from…` comment to the end of the file) with:

```ts
export const CERTIFICATE_TIERS = ['gold', 'silver', 'bronze', 'participant'] as const;
export type CertificateTier = (typeof CERTIFICATE_TIERS)[number];
export type CertificatePlacing = 1 | 2 | 3;

const PODIUM_TIERS: Record<CertificatePlacing, CertificateTier> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

/** The one place a rank becomes a certificate tier, so the API and the web mock can never disagree. */
export function certificateTier(rank: number | null): { placing: CertificatePlacing | null; tier: CertificateTier } {
  if (rank === 1 || rank === 2 || rank === 3) return { placing: rank, tier: PODIUM_TIERS[rank] };
  return { placing: null, tier: 'participant' };
}

// Mirrors the API's code alphabet: no 0/O, 1/I/L.
const CODE_PATTERN = /^BQ(\d+)([A-HJ-NP-Z2-9]{6})$/;

/** "bq4 k7m2qx" → "BQ4-K7M2QX"; null when it can't be a code. People type these from paper. */
export function normalizeCertificateCode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = CODE_PATTERN.exec(compact);
  return match ? `BQ${match[1]}-${match[2]}` : null;
}

/**
 * Everything a certificate is rendered from. Deliberately not a stored
 * document: a certificate is a view of participant + quest + result, and a
 * second copy of a name is a copy that can drift.
 */
export const certificateDataSchema = z.object({
  code: z.string(),
  fullName: z.string(),
  participantNumber: z.number().int(),
  questEdition: z.number().int(),
  questYear: z.number().int(),
  bookTitle: z.string(),
  bookAuthor: z.string(),
  /** 1–3 for the podium, null for everyone else. Full ranks stay on the leaderboard. */
  placing: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  tier: z.enum(CERTIFICATE_TIERS),
  /** How many finished — for copy like "among 412 readers"; the design may not use it. */
  finishedCount: z.number().int().nonnegative(),
  issuedAt: z.string(),
  imageUrl: z.string().url(),
  verifyUrl: z.string().url()
});

export type CertificateData = z.infer<typeof certificateDataSchema>;

export const CERTIFICATE_DELIVERY_STATUSES = ['idle', 'sending', 'sent', 'interrupted'] as const;
export type CertificateDeliveryStatus = (typeof CERTIFICATE_DELIVERY_STATUSES)[number];

/** The admin panel's view of sending certificates for the current quest. */
export const certificateDeliverySchema = z.object({
  status: z.enum(CERTIFICATE_DELIVERY_STATUSES),
  /** Finishers on the quest. */
  total: z.number().int().nonnegative(),
  /** Photo delivered in Telegram. */
  delivered: z.number().int().nonnegative(),
  /** No Telegram linked — in-app notification and /me only. */
  inAppOnly: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  /** Telegram error; picked up again by the next press. */
  failed: z.number().int().nonnegative(),
  /** Not processed yet (includes `failed`). */
  pending: z.number().int().nonnegative(),
  /** Of `pending`, how many can be DMed — for the confirm sheet. */
  pendingReachable: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable()
});

export type CertificateDelivery = z.infer<typeof certificateDeliverySchema>;
```

- [ ] **Step 2: Verify**: `pnpm --filter @bookquest/shared build && pnpm --filter @bookquest/shared typecheck`. Expected: no errors. The repo-wide `pnpm typecheck` now **fails** in `result.services.ts` (Task 4 fixes it) and the web mock (Task 6 fixes it), because `rank` is gone. That's expected. The repo is green again after Task 6. Until then, check each task with its own package's typecheck.

- [ ] **Step 3: Commit**: `feat(shared): certificate tiers, placing and delivery contract`

---

### Task 2: Dev seed for finishers

The quiz doesn't exist yet (spec §0), so every later task needs results to work against.

**Files:**
- Create: `apps/api/src/scripts/seed-results.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: `apps/api/src/scripts/seed-results.ts`**

```ts
/**
 * Dev only: fills the current quest with finishers so certificates can be built
 * before the quiz exists. Usage: pnpm --filter @bookquest/api seed:results [count]
 */
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';
import { QuestModel } from '../models/quest.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { ResultModel } from '../models/result.model.js';
import { UserModel } from '../models/user.model.js';

// Edge cases the template must survive: Cyrillic, the longest realistic name, apostrophes.
const NAMES = [
  'Sofia Karimova',
  'Aziz Rahimov',
  'Malika Yusupova',
  'Bobur Tursunov',
  'Дилноза Абдуллаева',
  'Muhammadabdulaziz Abdurakhmonova',
  "Oybek O'g'ilov",
  'Nilufar Saidova'
];

async function run(): Promise<void> {
  if (isProduction) throw new Error('seed:results refuses to run in production.');
  const count = Number(process.argv[2] ?? 40);

  await connectToDatabase();
  const quest = await QuestModel.findOne({ isCurrent: true });
  if (!quest) throw new Error('No current quest — run `pnpm --filter @bookquest/api seed` first.');

  // Seeded numbers start at 9000, clear of real ones, so a rerun appends instead of colliding.
  const existing = await ParticipantModel.countDocuments({ quest: quest._id, number: { $gte: 9000 } });
  for (let i = existing; i < existing + count; i += 1) {
    const name = NAMES[i % NAMES.length]!;
    // Users without telegramUserId exercise the "in-app only" path.
    const user = await UserModel.create({ firstName: name.split(' ')[0] });
    const participant = await ParticipantModel.create({
      number: 9000 + i,
      fullName: name,
      contact: { method: 'phone', value: `+99890000${String(i).padStart(4, '0')}` },
      quest: quest._id,
      user: user._id
    });
    await ResultModel.create({
      quest: quest._id,
      participant: participant._id,
      score: 20 - (i % 15),
      total: 20,
      durationMs: 600_000 + i * 7_000,
      submittedAt: new Date(quest.quizOpensAt.getTime() + i * 1000)
    });
  }

  // Publish: results become visible (and rank lazily) on the next read.
  await QuestModel.updateOne({ _id: quest._id }, { $set: { resultsAt: new Date(Date.now() - 60_000) } });
  logger.info({ created: count, edition: quest.edition }, 'Seeded finishers and published results');
  await disconnectFromDatabase();
}

run().catch((error: unknown) => {
  logger.error({ err: error }, 'seed:results failed');
  process.exit(1);
});
```

Check `PARTICIPANT_NUMBER_MAX` in `@bookquest/shared`. If 9000+ is above it, nothing breaks here (the seed writes the model directly, bypassing `registerParticipant`), but say so in the script's header comment.

- [ ] **Step 2: Script entry**: in `apps/api/package.json` scripts, after `"seed"`: `"seed:results": "tsx --env-file-if-exists=../../.env src/scripts/seed-results.ts",`

- [ ] **Step 3: Verify**: `pnpm --filter @bookquest/api seed && pnpm --filter @bookquest/api seed:results 40`. In `mongosh`: `db.results.countDocuments()` → 40, and `db.quests.findOne({isCurrent:true}).resultsAt` is in the past. `curl -s localhost:4000/api/v1/quests/current/results | jq '.data.podium | length'` → 3, and `db.results.find({rank:1}).count()` → 1 (ranked on that read).

- [ ] **Step 4: Commit**: `chore(api): seed:results — dev finishers for certificate work`

---

### Task 3: Render pipeline (placeholder template)

**Files:**
- Modify: `apps/api/package.json`, `apps/api/tsconfig.json`
- Create: `apps/api/src/certificates/samples.ts`, `apps/api/src/certificates/template.tsx`, `apps/api/src/certificates/render.ts`

**Interfaces:**
- Produces: `renderCertificatePng(data: CertificateData, options?: { sample?: boolean }): Promise<{ png: Buffer; etag: string }>`, `TEMPLATE_VERSION`, `CERTIFICATE_SAMPLES`, `CertificateSampleKey`.

- [ ] **Step 1: Dependencies**

```bash
pnpm --filter @bookquest/api add satori @resvg/resvg-js qrcode react @fontsource/archivo @fontsource/noto-sans
pnpm --filter @bookquest/api add -D @types/qrcode @types/react
```

- [ ] **Step 2: JSX**: in `apps/api/tsconfig.json` `compilerOptions`, add `"jsx": "react-jsx",`. React is only the JSX runtime here: satori reads the element tree and never runs React.

- [ ] **Step 3: `src/certificates/samples.ts`**

```ts
import type { CertificateData } from '@bookquest/shared';

const BASE: Omit<CertificateData, 'fullName' | 'placing' | 'tier'> = {
  code: 'SAMPLE',
  participantNumber: 42,
  questEdition: 4,
  questYear: 2026,
  bookTitle: 'The Alchemist',
  bookAuthor: 'Paulo Coelho',
  finishedCount: 412,
  issuedAt: '2026-12-14T15:00:00.000Z',
  imageUrl: 'https://example.invalid/sample.png',
  verifyUrl: 'https://example.invalid/verify/SAMPLE'
};

/** Fixed on purpose: a public preview that accepted a name would be a forgery tool. */
export const CERTIFICATE_SAMPLES = {
  gold: { ...BASE, fullName: 'Sofia Karimova', placing: 1, tier: 'gold' },
  silver: { ...BASE, fullName: 'Aziz Rahimov', placing: 2, tier: 'silver' },
  bronze: { ...BASE, fullName: 'Malika Yusupova', placing: 3, tier: 'bronze' },
  participant: { ...BASE, fullName: 'Bobur Tursunov', placing: null, tier: 'participant' },
  long: { ...BASE, fullName: 'Muhammadabdulaziz Abdurakhmonova', placing: null, tier: 'participant' },
  cyrillic: { ...BASE, fullName: 'Дилноза Абдуллаева', placing: 1, tier: 'gold' }
} satisfies Record<string, CertificateData>;

export type CertificateSampleKey = keyof typeof CERTIFICATE_SAMPLES;
export const CERTIFICATE_SAMPLE_KEYS = Object.keys(CERTIFICATE_SAMPLES) as [CertificateSampleKey, ...CertificateSampleKey[]];
```

- [ ] **Step 4: `src/certificates/template.tsx`**: the **placeholder**. Keep it plain; the real design replaces this whole file.

```tsx
import type { CertificateData, CertificateTier } from '@bookquest/shared';

/*
 * PLACEHOLDER — the organiser's design replaces this file (spec §8). Satori
 * rules: every element with more than one child needs display:flex; inline
 * styles only; no CSS grid; fonts are whatever render.ts loaded.
 */

const ACCENT: Record<CertificateTier, string> = {
  gold: '#C8A24A',
  silver: '#9AA3AD',
  bronze: '#B87344',
  participant: '#E2632A'
};

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' } as const;

// Satori can't auto-fit text, so the name steps down by length.
function nameSize(name: string): number {
  if (name.length <= 16) return 72;
  if (name.length <= 22) return 60;
  if (name.length <= 28) return 50;
  return 42;
}

export function CertificateTemplate({ data, qrDataUri, sample }: { data: CertificateData; qrDataUri: string; sample: boolean }) {
  const accent = ACCENT[data.tier];
  const issued = new Date(data.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      style={{
        width: 1123,
        height: 794,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '56px 72px 44px',
        backgroundColor: '#FFFAF3',
        border: `14px solid ${accent}`,
        fontFamily: 'Archivo, Noto Sans',
        color: '#14100C',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', fontSize: 16, fontWeight: 800, letterSpacing: 6, color: '#B84A1A' }}>BOOKQUEST</div>
      <div style={{ display: 'flex', marginTop: 6, fontSize: 13, letterSpacing: 2, color: '#6E6255' }}>
        {`EDITION ${data.questEdition} · ${data.questYear}`}
      </div>

      <div style={{ display: 'flex', marginTop: 40, fontSize: 22, fontWeight: 700, color: accent }}>
        {data.placing ? `${ORDINAL[data.placing]} place · Certificate of Achievement` : 'Certificate of Completion'}
      </div>

      <div style={{ display: 'flex', marginTop: 28, fontSize: nameSize(data.fullName), fontWeight: 800 }}>{data.fullName}</div>

      <div style={{ display: 'flex', marginTop: 24, maxWidth: 760, textAlign: 'center', fontSize: 20, color: '#4A3F35' }}>
        {data.placing
          ? `finished ${ORDINAL[data.placing]} among ${data.finishedCount} readers of ${data.bookTitle} by ${data.bookAuthor}.`
          : `read ${data.bookTitle} by ${data.bookAuthor} and completed the BookQuest ${data.questYear} quiz.`}
      </div>

      <div style={{ display: 'flex', flexGrow: 1 }} />

      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 14, color: '#6E6255' }}>
          <div style={{ display: 'flex' }}>BookQuest Team</div>
          <div style={{ display: 'flex' }}>{`Issued ${issued}`}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 18, fontWeight: 800, color: accent }}>{`№ ${data.participantNumber}`}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ display: 'flex', fontSize: 14, fontWeight: 700 }}>{data.code}</div>
          <img src={qrDataUri} width={96} height={96} />
        </div>
      </div>

      {sample && (
        <div
          style={{
            position: 'absolute',
            top: 330,
            left: 0,
            width: 1123,
            display: 'flex',
            justifyContent: 'center',
            fontSize: 140,
            fontWeight: 800,
            color: 'rgba(226, 99, 42, 0.14)',
            transform: 'rotate(-18deg)'
          }}
        >
          SAMPLE
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `src/certificates/render.ts`**

```ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori, { type SatoriOptions } from 'satori';
import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode';
import type { CertificateData } from '@bookquest/shared';
import { CertificateTemplate } from './template.js';

/** Bump whenever template.tsx changes: it's part of every cache key and ETag. */
export const TEMPLATE_VERSION = 1;

const WIDTH = 1123;
const HEIGHT = 794;
/** 2× the layout size: ≈190 dpi on A4, sharp in print, a few hundred KB to send. */
const PNG_WIDTH = WIDTH * 2;
const CACHE_LIMIT = 200;

const require = createRequire(import.meta.url);
type Font = SatoriOptions['fonts'][number];

// .woff, never .woff2: satori can't read woff2.
function font(file: string, name: string, weight: Font['weight']): Font {
  return { name, weight, style: 'normal', data: readFileSync(require.resolve(file)) };
}

// Loaded once at import. Archivo for Latin; Noto Sans is the fallback that covers Cyrillic names.
const FONTS: Font[] = [
  ...([400, 700, 800] as const).flatMap((weight) => [
    font(`@fontsource/archivo/files/archivo-latin-${weight}-normal.woff`, 'Archivo', weight),
    font(`@fontsource/archivo/files/archivo-latin-ext-${weight}-normal.woff`, 'Archivo', weight)
  ]),
  ...([400, 700, 800] as const).map((weight) =>
    font(`@fontsource/noto-sans/files/noto-sans-cyrillic-${weight}-normal.woff`, 'Noto Sans', weight)
  )
];

/** Insertion-ordered Map as an LRU: a hit is re-inserted at the end, the oldest entry is evicted first. */
const cache = new Map<string, Buffer>();

function remember(key: string, png: Buffer): void {
  cache.set(key, png);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

async function qrDataUri(url: string): Promise<string> {
  // Dark on white whatever the design's background, with a 4-module quiet zone, so phone cameras read it.
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#14100C', light: '#FFFFFF' } });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function renderCertificatePng(
  data: CertificateData,
  options: { sample?: boolean } = {}
): Promise<{ png: Buffer; etag: string }> {
  const sample = options.sample ?? false;
  // The data is part of the key, so a corrected name re-renders without anyone invalidating anything.
  const etag = createHash('sha256').update(JSON.stringify({ v: TEMPLATE_VERSION, sample, data })).digest('base64url').slice(0, 27);

  const cached = cache.get(etag);
  if (cached) {
    cache.delete(etag);
    cache.set(etag, cached);
    return { png: cached, etag };
  }

  const svg = await satori(CertificateTemplate({ data, qrDataUri: await qrDataUri(data.verifyUrl), sample }), {
    width: WIDTH,
    height: HEIGHT,
    fonts: FONTS
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: PNG_WIDTH }, font: { loadSystemFonts: false } }).render().asPng();

  remember(etag, png);
  return { png, etag };
}
```

If `require.resolve` rejects a `@fontsource/.../files/...` path because of a package `exports` map, run `ls node_modules/@fontsource/archivo/files | grep woff$` from `apps/api` and resolve `@fontsource/archivo/package.json` instead, then `path.join(path.dirname(thatPath), 'files', name)`.

- [ ] **Step 6: Render check**: there are no routes yet (Task 4 adds them), so render the samples with a throwaway script that isn't committed:

```bash
cd apps/api && cat > /tmp/render-check.ts <<'EOF'
import { writeFileSync } from 'node:fs';
import { renderCertificatePng } from './src/certificates/render.js';
import { CERTIFICATE_SAMPLES } from './src/certificates/samples.js';
for (const [key, data] of Object.entries(CERTIFICATE_SAMPLES)) {
  const started = performance.now();
  const { png } = await renderCertificatePng(data, { sample: true });
  writeFileSync(`/tmp/cert-${key}.png`, png);
  console.log(key, `${Math.round(performance.now() - started)} ms`, `${Math.round(png.length / 1024)} KB`);
}
EOF
cp /tmp/render-check.ts ./render-check.ts && npx tsx render-check.ts; rm render-check.ts
```

- [ ] **Step 7: Typecheck**: `pnpm --filter @bookquest/api typecheck` (the shared change from Task 1 still breaks `result.services.ts` until Task 4; only errors in the new files count here).

- [ ] **Step 8: Verify** by opening `/tmp/cert-*.png`:
  - Six files, each 2246 × 1588 (`file /tmp/cert-gold.png`).
  - `gold` shows "1st place", `participant` shows "Certificate of Completion" with no place.
  - `cyrillic` shows the Cyrillic name in real glyphs, with no empty boxes.
  - `long` fits on one line inside the border.
  - The QR code on any of them scans with a phone camera to `https://example.invalid/verify/SAMPLE`.
  - The `SAMPLE` watermark is visible on all six.
  - After the first render (font load), each takes under 300 ms.
  - Repeat the render inside the deploy image (`docker run … npx tsx render-check.ts`, or on the host) to prove the resvg binary resolves there.

- [ ] **Step 9: Commit**: `feat(api): certificate render pipeline — satori + resvg, placeholder template`

---

### Task 4: Certificate service and public endpoints

**Files:**
- Modify: `apps/api/src/config/env.ts`, `apps/api/src/services/result.services.ts`, `apps/api/src/controllers/result.controllers.ts`, `apps/api/src/middlewares/rate-limit.middleware.ts`, `apps/api/src/routes/index.ts`, `.env.example`
- Create: `apps/api/src/services/certificate.services.ts`, `apps/api/src/validators/certificate.validators.ts`, `apps/api/src/controllers/certificate.controllers.ts`, `apps/api/src/routes/certificate.routes.ts`

**Interfaces:**
- Consumes: `renderCertificatePng`, `CERTIFICATE_SAMPLES` (Task 3); `certificateTier`, `normalizeCertificateCode` (Task 1).
- Produces: `buildCertificateData(...)`, `getCertificateForUser(user)`, `getCertificateByCode(raw)`, `getCertificateImage(raw)`, all used by Task 5.

- [ ] **Step 1: `env.ts`**: after `publicApiUrl`:

```ts
/** Where QR codes and bot buttons point. Dev falls back to Vite's port; delivery refuses to start without the real one. */
export const webAppUrl = (env.WEB_APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
```

and at the end, beside the other production warnings:

```ts
if (isProduction && !env.WEB_APP_URL) {
  configWarnings.push('WEB_APP_URL is not set — certificate QR codes and links will be wrong, and sending certificates is disabled.');
}
```

In `.env.example`, extend the `WEB_APP_URL` comment: `# Also printed on every certificate as the verify link (QR code) — set before sending certificates.`

- [ ] **Step 2: `result.services.ts`**
  - **Delete** `getCertificateForUser`, along with the now-unused `CertificateData`, `UserDocument` and `requireParticipantForUser` imports.
  - **Export** `ensureRanked` and `requirePublished` (add `export`). Keep `createCertificateCode` where it is: ranking writes the code.

- [ ] **Step 3: `services/certificate.services.ts`**

```ts
import type { Types } from 'mongoose';
import { certificateTier, normalizeCertificateCode, type CertificateData } from '@bookquest/shared';
import { ResultModel } from '../models/result.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { QuestModel, type QuestDocument } from '../models/quest.model.js';
import type { UserDocument } from '../models/user.model.js';
import { publicApiUrl, webAppUrl } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';
import { renderCertificatePng } from '../certificates/render.js';
import { CERTIFICATE_SAMPLES, type CertificateSampleKey } from '../certificates/samples.js';
import { requireCurrentQuestDocument } from './quest.services.js';
import { requireParticipantForUser } from './participant.services.js';
import { ensureRanked, requirePublished } from './result.services.js';

interface CertificateSource {
  result: { certificateCode?: string | null; rank?: number | null };
  participant: { number: number; fullName: string };
  quest: Pick<QuestDocument, 'edition' | 'year' | 'book' | 'resultsAt'>;
  finishedCount: number;
}

/** The only place CertificateData is assembled, so /me, verify, the image and the bot can't drift apart. */
export function buildCertificateData({ result, participant, quest, finishedCount }: CertificateSource): CertificateData {
  const code = result.certificateCode ?? '';
  return {
    code,
    fullName: participant.fullName,
    participantNumber: participant.number,
    questEdition: quest.edition,
    questYear: quest.year,
    bookTitle: quest.book.title,
    bookAuthor: quest.book.author,
    ...certificateTier(result.rank ?? null),
    finishedCount,
    issuedAt: quest.resultsAt.toISOString(),
    imageUrl: `${publicApiUrl}/api/v1/certificates/${code}/image.png`,
    verifyUrl: `${webAppUrl}/verify/${code}`
  };
}

export function countFinishers(questId: Types.ObjectId): Promise<number> {
  return ResultModel.countDocuments({ quest: questId });
}

export async function getCertificateForUser(user: UserDocument): Promise<CertificateData> {
  const quest = await requireCurrentQuestDocument();
  requirePublished(quest);
  await ensureRanked(quest);

  const participant = await requireParticipantForUser(user, quest);
  const result = await ResultModel.findOne({ quest: quest._id, participant: participant.id }).lean();
  if (!result) throw ApiError.notFound('There is no completed quiz to certify yet.');

  return buildCertificateData({ result, participant, quest, finishedCount: await countFinishers(quest._id) });
}

/** Any edition: a 2025 certificate must still verify in 2027. Holding the code is the permission. */
export async function getCertificateByCode(raw: string): Promise<CertificateData> {
  const code = normalizeCertificateCode(raw);
  const notFound = ApiError.notFound('We couldn’t find a certificate with this code.');
  if (!code) throw notFound;

  const result = await ResultModel.findOne({ certificateCode: code }).lean();
  if (!result) throw notFound;

  const [participant, quest, finishedCount] = await Promise.all([
    ParticipantModel.findById(result.participant).select('number fullName').lean(),
    QuestModel.findById(result.quest).lean(),
    countFinishers(result.quest)
  ]);
  if (!participant || !quest) throw notFound;

  return buildCertificateData({ result, participant, quest, finishedCount });
}

export async function getCertificateImage(raw: string) {
  const data = await getCertificateByCode(raw);
  return { ...(await renderCertificatePng(data)), data };
}

export function getSampleImage(key: CertificateSampleKey) {
  return renderCertificatePng(CERTIFICATE_SAMPLES[key], { sample: true });
}

/** ASCII fallback plus RFC 5987 for the real (possibly Cyrillic) name. */
export function certificateFileName(data: CertificateData): { ascii: string; utf8: string } {
  const slug = data.fullName.replace(/[^\p{L}\p{N}]+/gu, '-');
  return { ascii: `BookQuest-${data.questYear}-certificate.png`, utf8: `BookQuest-${data.questYear}-${slug}.png` };
}
```

If `QuestDocument['book']` doesn't line up with `.lean()` output in the `Pick`, widen `quest` to `{ edition: number; year: number; book: { title: string; author: string }; resultsAt: Date }`.

- [ ] **Step 4: `result.controllers.ts`**: change `getMyCertificate` to call `certificateService.getCertificateForUser` (`import * as certificateService from '../services/certificate.services.js';`).

- [ ] **Step 5: Rate limit**: in `rate-limit.middleware.ts`:

```ts
/** Verify and image lookups are public; 30/min is plenty for your own certificate and makes guessing codes pointless. */
export const certificateRateLimit = limiter({
  windowMs: MINUTE,
  limit: 30,
  message: 'Too many lookups. Try again in a minute.'
});
```

- [ ] **Step 6: `validators/certificate.validators.ts`**

```ts
import { z } from 'zod';
import { CERTIFICATE_SAMPLE_KEYS } from '../certificates/samples.js';

// Loose on purpose: normalizeCertificateCode decides; this only bounds the input.
export const certificateCodeParams = z.object({ code: z.string().min(6).max(32) });
export const certificateImageQuery = z.object({ download: z.literal('1').optional() });
export const certificateSampleParams = z.object({ sample: z.enum(CERTIFICATE_SAMPLE_KEYS) });
```

- [ ] **Step 7: `controllers/certificate.controllers.ts`**

```ts
import type { Request, Response } from 'express';
import * as certificateService from '../services/certificate.services.js';
import type { CertificateSampleKey } from '../certificates/samples.js';
import { ok } from '../utils/respond.js';

function sendPng(req: Request, res: Response, png: Buffer, etag: string): void {
  const tag = `"${etag}"`;
  res.setHeader('ETag', tag);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  if (req.headers['if-none-match'] === tag) {
    res.status(304).end();
    return;
  }
  res.type('png').send(png);
}

/** GET /api/v1/certificates/:code */
export async function getByCode(req: Request, res: Response): Promise<void> {
  ok(res, await certificateService.getCertificateByCode(String(req.params.code)));
}

/** GET /api/v1/certificates/:code/image.png[?download=1] */
export async function getImage(req: Request, res: Response): Promise<void> {
  const { png, etag, data } = await certificateService.getCertificateImage(String(req.params.code));
  const name = certificateService.certificateFileName(data);
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${name.ascii}"; filename*=UTF-8''${encodeURIComponent(name.utf8)}`);
  sendPng(req, res, png, etag);
}

/** GET /api/v1/certificates/preview/:sample.png — fixed sample data, stamped SAMPLE. */
export async function getPreview(req: Request, res: Response): Promise<void> {
  const { png, etag } = await certificateService.getSampleImage(req.params.sample as CertificateSampleKey);
  sendPng(req, res, png, etag);
}
```

- [ ] **Step 8: Routes**: `routes/certificate.routes.ts`:

```ts
import { Router } from 'express';
import * as certificateController from '../controllers/certificate.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { certificateRateLimit } from '../middlewares/rate-limit.middleware.js';
import { certificateCodeParams, certificateImageQuery, certificateSampleParams } from '../validators/certificate.validators.js';

export const certificateRoutes: Router = Router();

// Public by design: the QR code on paper opens these with no session.
certificateRoutes.use(certificateRateLimit);

// Before /:code, so "preview" is never read as a code.
certificateRoutes.get('/preview/:sample.png', validate(certificateSampleParams, 'params'), certificateController.getPreview);
certificateRoutes.get(
  '/:code/image.png',
  validate(certificateCodeParams, 'params'),
  validate(certificateImageQuery, 'query'),
  certificateController.getImage
);
certificateRoutes.get('/:code', validate(certificateCodeParams, 'params'), certificateController.getByCode);
```

In `routes/index.ts`: `import { certificateRoutes } from './certificate.routes.js';` and `apiRoutes.use('/certificates', certificateRoutes);` after `/participants`.

- [ ] **Step 9: Verify.** Run `pnpm --filter @bookquest/api typecheck`, which should be green now. With the API running on the Task 2 seed:

```bash
CODE=$(mongosh --quiet bookquest --eval 'db.results.findOne({rank:1}).certificateCode')
curl -s localhost:4000/api/v1/certificates/$CODE | jq '.data | {placing, tier, finishedCount, imageUrl, verifyUrl}'
curl -s localhost:4000/api/v1/certificates/$(echo $CODE | tr 'A-Z' 'a-z' | tr -d -) | jq .data.code   # normalised
curl -s -o /tmp/me.png -D - localhost:4000/api/v1/certificates/$CODE/image.png | grep -i 'content-type\|etag'
curl -s -o /dev/null -w '%{http_code}\n' -H "If-None-Match: $(curl -sI localhost:4000/api/v1/certificates/$CODE/image.png | grep -i etag | cut -d' ' -f2 | tr -d '\r')" localhost:4000/api/v1/certificates/$CODE/image.png
curl -sI "localhost:4000/api/v1/certificates/$CODE/image.png?download=1" | grep -i disposition
curl -s -o /dev/null -w '%{http_code}\n' localhost:4000/api/v1/certificates/preview/gold.png
curl -s -o /dev/null -w '%{http_code}\n' localhost:4000/api/v1/certificates/preview/forged.png
curl -s -o /dev/null -w '%{http_code}\n' localhost:4000/api/v1/certificates/BQ4-ZZZZZZ
for i in $(seq 1 31); do curl -s -o /dev/null -w '%{http_code} ' localhost:4000/api/v1/certificates/BQ4-ZZZZZZ; done; echo
```

Expected, in order:
  - `placing: 1, tier: "gold"`, `finishedCount: 40`, with absolute `imageUrl` and `verifyUrl`.
  - The lowercase, dash-less code resolves to the canonical code.
  - `image/png` plus an ETag.
  - `304`.
  - `attachment; filename=…; filename*=UTF-8''…`.
  - `200`, then `400` for `forged`.
  - `404`.
  - The run ends in `429`.

Then:
  - Pick a rank-4 code: `placing: null, tier: "participant"`.
  - Sign in as a seeded participant's user (or point the dev token at one): `GET /participants/me/certificate` returns the same shape.
  - Rename that participant in `mongosh`, and the image ETag changes.
  - Create a new edition through the admin editor: the **old** code still resolves (`GET /certificates/$CODE` → 200).
  - The API log shows codes but no names.

- [ ] **Step 10: Commit**: `feat(api): certificate by code — verify JSON, PNG, sample previews, rate limit`

---

### Task 5: Delivery

**Files:**
- Create: `apps/api/src/utils/rate-gate.ts`, `apps/api/src/models/certificate-delivery.model.ts`, `apps/api/src/services/certificate-delivery.services.ts`, `apps/api/src/controllers/admin/certificate.controllers.ts`, `apps/api/src/routes/admin/certificate.routes.ts`
- Modify: `apps/api/src/services/broadcast.services.ts`, `apps/api/src/utils/telegram-send.ts`, `apps/api/src/models/result.model.ts`, `apps/api/src/routes/admin/index.ts`, `apps/api/src/server.ts`

**Interfaces:**
- Produces: `POST /api/v1/admin/certificates/send` (202 + `CertificateDelivery`), `GET /api/v1/admin/certificates/delivery` (`CertificateDelivery`), `markInterruptedCertificateDeliveries()`.

- [ ] **Step 1: `utils/rate-gate.ts`**: move `sleep` and `createRateGate` (with their comments) out of `broadcast.services.ts` unchanged, `export` both, and import them back into `broadcast.services.ts`.

- [ ] **Step 2: `telegram-send.ts`**: factor the response handling out of `sendTelegramMessage` and add the photo sender:

```ts
async function outcomeOf(response: Response, telegramUserId: string): Promise<SendOutcome> {
  if (response.ok) return { status: 'sent' };
  logger.warn({ telegramUserId, status: response.status }, 'Telegram send failed');
  if (response.status === 403) return { status: 'blocked' };
  if (response.status === 429) return { status: 'rate-limited', retryAfterMs: await readRetryAfterMs(response) };
  return { status: 'failed' };
}
```

`sendTelegramMessage` then ends its `try` with `return outcomeOf(response, telegramUserId);`. Add:

```ts
/** Multipart sendPhoto with an optional web_app button. Same contract: never throws. */
export async function sendTelegramPhoto(
  telegramUserId: string,
  photo: { png: Buffer; fileName: string },
  caption: string,
  button?: { text: string; webAppUrl: string }
): Promise<SendOutcome> {
  try {
    const form = new FormData();
    form.set('chat_id', telegramUserId);
    form.set('caption', caption);
    form.set('photo', new Blob([new Uint8Array(photo.png)], { type: 'image/png' }), photo.fileName);
    if (button) {
      form.set('reply_markup', JSON.stringify({ inline_keyboard: [[{ text: button.text, web_app: { url: button.webAppUrl } }]] }));
    }
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
      // A photo upload takes longer than a text message.
      signal: AbortSignal.timeout(30_000)
    });
    return outcomeOf(response, telegramUserId);
  } catch (error) {
    logger.warn({ telegramUserId, error }, 'Telegram photo send failed (network error)');
    return { status: 'failed' };
  }
}
```

- [ ] **Step 3: `result.model.ts`**: add after `certificateCode`:

```ts
    /** Set once this certificate is done: delivered, or not deliverable (blocked / no Telegram). Null = the next send picks it up. */
    certificateSentAt: { type: Date, default: null },
    certificateSendError: { type: String, enum: ['blocked', 'failed', 'no_telegram', null], default: null },
    /** Claimed before the in-app notification is written, so a resumed send never notifies twice. */
    certificateNotifiedAt: { type: Date, default: null },
```

and, after the existing indexes, `// The delivery loop's "what's left" query.` followed by `resultSchema.index({ quest: 1, certificateSentAt: 1 });`

- [ ] **Step 4: `models/certificate-delivery.model.ts`**

```ts
import { Schema, model, type InferSchemaType } from 'mongoose';
import { CERTIFICATE_DELIVERY_STATUSES } from '@bookquest/shared';

/** One row per quest: is a send running, and when. Per-person progress lives on Result. */
const certificateDeliverySchema = new Schema(
  {
    quest: { type: Schema.Types.ObjectId, ref: 'Quest', required: true, unique: true },
    status: { type: String, enum: CERTIFICATE_DELIVERY_STATUSES, required: true },
    startedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export type CertificateDeliveryAttributes = InferSchemaType<typeof certificateDeliverySchema>;
export const CertificateDeliveryModel = model('CertificateDelivery', certificateDeliverySchema);
```

- [ ] **Step 5: `services/certificate-delivery.services.ts`**

```ts
import type { Types } from 'mongoose';
import type { CertificateData, CertificateDelivery, CertificateDeliveryStatus } from '@bookquest/shared';
import { env, webAppUrl } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ResultModel } from '../models/result.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { CertificateDeliveryModel } from '../models/certificate-delivery.model.js';
import type { QuestDocument } from '../models/quest.model.js';
import { ApiError } from '../utils/api-error.js';
import { isDuplicateKeyError } from '../utils/mongo.js';
import { createRateGate } from '../utils/rate-gate.js';
import { sendTelegramPhoto } from '../utils/telegram-send.js';
import { renderCertificatePng } from '../certificates/render.js';
import { requireCurrentQuestDocument } from './quest.services.js';
import { ensureRanked } from './result.services.js';
import { buildCertificateData, certificateFileName, countFinishers } from './certificate.services.js';

// Same budget as broadcasts: under Telegram's ~30 msg/s bot-wide limit.
const CONCURRENCY = 10;
const MAX_PER_SECOND = 25;

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' } as const;
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;

function caption(data: CertificateData): string {
  const first = data.fullName.split(' ')[0];
  return data.placing
    ? `${MEDAL[data.placing]} ${first}, you finished ${ORDINAL[data.placing]} in BookQuest ${data.questYear}! Here's your certificate.`
    : `${first}, you finished BookQuest ${data.questYear}. Here's your certificate. Thank you for reading with us!`;
}

export async function startCertificateDelivery(startedBy: UserDocument): Promise<CertificateDelivery> {
  if (!env.WEB_APP_URL) throw ApiError.conflict('Set WEB_APP_URL first — every certificate’s QR code and link point to it.');

  const quest = await requireCurrentQuestDocument();
  if (new Date() < quest.resultsAt) throw ApiError.conflict('Results are not published yet.');
  await ensureRanked(quest);

  try {
    // The unique index on quest turns a concurrent second press into a duplicate-key error.
    await CertificateDeliveryModel.findOneAndUpdate(
      { quest: quest._id, status: { $ne: 'sending' } },
      { $set: { status: 'sending', startedBy: startedBy._id, startedAt: new Date(), completedAt: null } },
      { upsert: true }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) throw ApiError.conflict('Certificates are already being sent.');
    throw error;
  }

  // deliver() handles its own errors; this keeps a slip from becoming an unhandled rejection.
  void deliver(quest).catch(() => undefined);
  return getDeliveryStatus();
}

async function deliver(quest: QuestDocument): Promise<void> {
  const finishedCount = await countFinishers(quest._id);
  const pending = await ResultModel.find({ quest: quest._id, certificateSentAt: null })
    .select('participant rank certificateCode certificateNotifiedAt')
    .lean();
  const participants = await ParticipantModel.find({ _id: { $in: pending.map((row) => row.participant) } })
    .select('number fullName user')
    .lean();
  const users = await UserModel.find({ _id: { $in: participants.map((row) => row.user) } })
    .select('telegramUserId dmBlockedAt')
    .lean();
  const participantById = new Map(participants.map((row) => [String(row._id), row]));
  const userById = new Map(users.map((row) => [String(row._id), row]));

  const gate = createRateGate(MAX_PER_SECOND);
  const blockedUsers: Types.ObjectId[] = [];
  let next = 0;

  const finish = (id: Types.ObjectId, error: 'blocked' | 'failed' | 'no_telegram' | null) =>
    ResultModel.updateOne(
      { _id: id },
      // 'failed' stays pending so the next press retries it.
      { $set: { certificateSendError: error, certificateSentAt: error === 'failed' ? null : new Date() } }
    );

  async function sendOne(result: (typeof pending)[number]): Promise<void> {
    const participant = participantById.get(String(result.participant));
    if (!participant) return void (await finish(result._id, 'failed'));
    const user = userById.get(String(participant.user));
    const data = buildCertificateData({ result, participant, quest, finishedCount });

    // Claim first, then write: a crash between the two loses one notification rather than doubling it.
    const claim = await ResultModel.updateOne(
      { _id: result._id, certificateNotifiedAt: null },
      { $set: { certificateNotifiedAt: new Date() } }
    );
    if (claim.modifiedCount === 1 && user) {
      await NotificationModel.create({
        user: user._id,
        kind: 'system',
        title: 'Your certificate is ready',
        body: data.placing
          ? `You finished ${ORDINAL[data.placing]} in BookQuest ${data.questYear}. Your certificate is on your profile.`
          : `Thank you for finishing BookQuest ${data.questYear}. Your certificate is on your profile.`
      });
    }

    if (!user?.telegramUserId) return void (await finish(result._id, 'no_telegram'));
    if (user.dmBlockedAt) return void (await finish(result._id, 'blocked'));

    const { png } = await renderCertificatePng(data);
    const photo = { png, fileName: certificateFileName(data).ascii };
    const button = { text: 'Open in BookQuest', webAppUrl: `${webAppUrl}/me` };

    await gate.wait();
    let outcome = await sendTelegramPhoto(user.telegramUserId, photo, caption(data), button);
    if (outcome.status === 'rate-limited') {
      gate.pause(outcome.retryAfterMs);
      await gate.wait();
      outcome = await sendTelegramPhoto(user.telegramUserId, photo, caption(data), button);
    }

    if (outcome.status === 'sent') await finish(result._id, null);
    else if (outcome.status === 'blocked') {
      blockedUsers.push(user._id);
      await finish(result._id, 'blocked');
    } else await finish(result._id, 'failed');
  }

  async function worker(): Promise<void> {
    while (next < pending.length) await sendOne(pending[next++]!);
  }

  let status: CertificateDeliveryStatus = 'sent';
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  } catch (error) {
    logger.error({ err: error, edition: quest.edition }, 'Certificate delivery stopped');
    status = 'interrupted';
  }

  await Promise.all([
    CertificateDeliveryModel.updateOne({ quest: quest._id }, { $set: { status, completedAt: new Date() } }),
    blockedUsers.length > 0 && UserModel.updateMany({ _id: { $in: blockedUsers } }, { $set: { dmBlockedAt: new Date() } })
  ]).catch((error: unknown) => logger.error({ err: error, edition: quest.edition }, 'Could not record certificate delivery outcome'));
  logger.info({ edition: quest.edition, processed: pending.length, status }, 'Certificate delivery finished');
}

// $ifNull: rows written before these fields existed have them *missing*, and in an expression missing ≠ null.
const field = (name: string) => ({ $ifNull: [`$${name}`, null] });
const countWhen = (condition: object) => ({ $sum: { $cond: [condition, 1, 0] } });

export async function getDeliveryStatus(): Promise<CertificateDelivery> {
  const quest = await requireCurrentQuestDocument();

  const [counts, delivery, pendingRows] = await Promise.all([
    ResultModel.aggregate<Record<string, number>>([
      { $match: { quest: quest._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          delivered: countWhen({ $and: [{ $ne: [field('certificateSentAt'), null] }, { $eq: [field('certificateSendError'), null] }] }),
          inAppOnly: countWhen({ $eq: [field('certificateSendError'), 'no_telegram'] }),
          blocked: countWhen({ $eq: [field('certificateSendError'), 'blocked'] }),
          failed: countWhen({ $eq: [field('certificateSendError'), 'failed'] }),
          pending: countWhen({ $eq: [field('certificateSentAt'), null] })
        }
      }
    ]),
    CertificateDeliveryModel.findOne({ quest: quest._id }).lean(),
    ResultModel.find({ quest: quest._id, certificateSentAt: null }).select('participant').lean()
  ]);

  const participants = await ParticipantModel.find({ _id: { $in: pendingRows.map((row) => row.participant) } }).select('user').lean();
  const pendingReachable = await UserModel.countDocuments({
    _id: { $in: participants.map((row) => row.user) },
    telegramUserId: { $type: 'string' },
    dmBlockedAt: null
  });

  const row = counts[0];
  return {
    status: (delivery?.status as CertificateDeliveryStatus | undefined) ?? 'idle',
    total: row?.total ?? 0,
    delivered: row?.delivered ?? 0,
    inAppOnly: row?.inAppOnly ?? 0,
    blocked: row?.blocked ?? 0,
    failed: row?.failed ?? 0,
    pending: row?.pending ?? 0,
    pendingReachable,
    startedAt: delivery?.startedAt.toISOString() ?? null,
    completedAt: delivery?.completedAt?.toISOString() ?? null
  };
}

/** Boot: a delivery left "sending" by a restart would poll forever. Same single-instance assumption as broadcasts. */
export async function markInterruptedCertificateDeliveries(): Promise<number> {
  const result = await CertificateDeliveryModel.updateMany(
    { status: 'sending' },
    { $set: { status: 'interrupted', completedAt: new Date() } }
  );
  return result.modifiedCount;
}
```

- [ ] **Step 6: Admin controller + routes**: `controllers/admin/certificate.controllers.ts`:

```ts
import type { Request, Response } from 'express';
import * as deliveryService from '../../services/certificate-delivery.services.js';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ok } from '../../utils/respond.js';

/** POST /api/v1/admin/certificates/send — 202: sending continues in the background. */
export async function sendCertificates(req: Request, res: Response): Promise<void> {
  ok(res, await deliveryService.startCertificateDelivery(currentUser(req)), 202);
}

/** GET /api/v1/admin/certificates/delivery */
export async function getDelivery(_req: Request, res: Response): Promise<void> {
  ok(res, await deliveryService.getDeliveryStatus());
}
```

`routes/admin/certificate.routes.ts`:

```ts
import { Router } from 'express';
import * as adminCertificateController from '../../controllers/admin/certificate.controllers.js';

export const adminCertificateRoutes: Router = Router();

adminCertificateRoutes.get('/delivery', adminCertificateController.getDelivery);
adminCertificateRoutes.post('/send', adminCertificateController.sendCertificates);
```

In `routes/admin/index.ts`: import it and `adminRoutes.use('/certificates', adminCertificateRoutes);`.

- [ ] **Step 7: Boot recovery**: in `server.ts`, after `markInterruptedBroadcasts`:

```ts
  const interruptedCertificates = await markInterruptedCertificateDeliveries();
  if (interruptedCertificates > 0) logger.warn('Marked a certificate delivery left mid-send as interrupted — press Send again to finish it');
```

- [ ] **Step 8: Typecheck**: `pnpm --filter @bookquest/api typecheck`.

- [ ] **Step 9: Test bot setup.** Use a **test bot token**, never the production bot. Link three Telegram accounts to seeded users by setting `telegramUserId` on three `users` rows in `mongosh`: A (normal), B (blocks the bot before the send) and C (linked, then `dmBlockedAt: new Date()` set by hand). Leave the rest unlinked. Set `WEB_APP_URL` to the ngrok URL.

- [ ] **Step 10: Verify** (`$ADMIN` = an admin session token):

```bash
H="Authorization: Bearer $ADMIN"
curl -s -H "$H" localhost:4000/api/v1/admin/certificates/delivery | jq .data          # idle, pending 40, pendingReachable 2 (A, B)
curl -s -X POST -H "$H" localhost:4000/api/v1/admin/certificates/send & curl -s -X POST -H "$H" localhost:4000/api/v1/admin/certificates/send; wait
watch -n1 "curl -s -H '$H' localhost:4000/api/v1/admin/certificates/delivery | jq -c .data"
```

Expected:
  - Before the send, the status is `idle`, `pending: 40`, `pendingReachable: 2`, with the counts correct even though the seeded rows predate the new fields (Review Focus 1).
  - Of the two simultaneous POSTs, one returns 202 and the other 409 `Certificates are already being sent.`
  - Account A receives the photo with its caption and an **Open in BookQuest** button that opens `/me`. The photo is legible, and the podium caption carries the medal emoji when A's result is rank 1–3 (set ranks in `mongosh` to test).
  - B ends as `blocked`, with `users.dmBlockedAt` set. C ends as `blocked` and is never attempted.
  - The other 37 end as `inAppOnly`.
  - `db.notifications.countDocuments({kind:'system'})` → 40.
  - The final status is `sent`, with `delivered: 1, blocked: 2, inAppOnly: 37, pending: 0`.
  - Press Send again: 202, `processed: 0` in the log, no new messages, and still 40 notifications.
  - Set `certificateSentAt: null, certificateSendError: 'failed'` on A, press again: A gets one photo, and still no second notification.
  - **Interruption:** reseed with `seed:results 200`, press Send, and kill the API after a few seconds. On restart, the log reports the interrupted delivery and the status is `interrupted`. Press Send and it finishes the rest. `db.notifications.aggregate([{ $group: { _id: '$user', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])` is empty.
  - Remove `WEB_APP_URL` and restart: POST → 409 naming `WEB_APP_URL`.
  - Run `grep` over the API log for a seeded name: no hits.

- [ ] **Step 11: Commit**: `feat(api): send certificates — bot photos, in-app notifications, resumable delivery`

---

### Task 6: Web — `/me` certificate image, download, share

**Files:**
- Modify: `apps/web/src/lib/telegram.ts`, `apps/web/src/lib/api/mock/people.ts`, `apps/web/src/lib/api/mock/routes.ts`, `apps/web/src/features/profile/components/Certificate.tsx`, `apps/web/src/styles/results.css`, `apps/web/src/styles/profile.css`
- Create: `apps/web/src/assets/certificates/gold.svg`, `silver.svg`, `bronze.svg`, `participant.svg`

- [ ] **Step 1: Telegram bridge**: in `TelegramWebApp` add:

```ts
  /** Bot API 8.0+. Older clients don't have it — callers fall back to openLink. */
  downloadFile?: (params: { url: string; file_name: string }, callback?: (accepted: boolean) => void) => void;
```

and below `openTelegramLink`:

```ts
/** Telegram's own download sheet; `false` means the caller should fall back (older client, or the plain web). */
export function downloadFile(url: string, fileName: string): boolean {
  if (!isInsideTelegram()) return false;
  const download = getTelegramWebApp()?.downloadFile;
  if (!download) return false;
  try {
    download({ url, file_name: fileName });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Mock placeholders**: four SVGs at 1123 × 794. Each is a coloured border (`#C8A24A`, `#9AA3AD`, `#B87344`, `#E2632A`), a warm white fill (`#FFFAF3`), and centred text `MOCK CERTIFICATE · GOLD` (etc.). Example `gold.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1123" height="794" viewBox="0 0 1123 794">
  <rect width="1123" height="794" fill="#FFFAF3"/>
  <rect x="7" y="7" width="1109" height="780" fill="none" stroke="#C8A24A" stroke-width="14"/>
  <text x="561" y="410" text-anchor="middle" font-family="sans-serif" font-size="44" font-weight="700" fill="#14100C">MOCK CERTIFICATE · GOLD</text>
</svg>
```

- [ ] **Step 3: `mock/people.ts`**: `buildCertificate` now takes `(participant, quest, rank, finishedCount)` and returns the new shape:

```ts
import { certificateTier } from '@bookquest/shared';
import gold from '@/assets/certificates/gold.svg';
import silver from '@/assets/certificates/silver.svg';
import bronze from '@/assets/certificates/bronze.svg';
import participantArt from '@/assets/certificates/participant.svg';

const MOCK_ART = { gold, silver, bronze, participant: participantArt } as const;

export function buildCertificate(participant: Participant, quest: Quest, rank: number | null, finishedCount: number): CertificateData {
  const code = certificateCode(quest.edition, String(participant.number));
  const { placing, tier } = certificateTier(rank);
  return {
    code,
    fullName: participant.fullName,
    participantNumber: participant.number,
    questEdition: quest.edition,
    questYear: quest.year,
    bookTitle: quest.book.title,
    bookAuthor: quest.book.author,
    placing,
    tier,
    finishedCount,
    issuedAt: quest.resultsAt,
    // Absolute, as the API returns: the schema says url, and Download appends ?download=1.
    imageUrl: new URL(MOCK_ART[tier], window.location.origin).href,
    verifyUrl: `${window.location.origin}/verify/${code}`
  };
}
```

Check that `certificateCode` in the mock produces codes that `normalizeCertificateCode` accepts (`BQ{edition}-` plus 6 characters from the API alphabet). If it doesn't, change it to derive 6 characters from that alphabet using the participant number.

- [ ] **Step 4: `mock/routes.ts`**:
  - In `myCertificate`, pass `leaderboard.length` as the new 4th argument.
  - Add a public verify route above `/participants`:

```ts
function certificateByCode(context: Context): Result {
  const quest = requireCurrentQuest();
  requirePublishedResults(quest);
  const code = normalizeCertificateCode(context.params.code ?? '');
  const { leaderboard } = buildResults(quizTakers(getState()), quest);
  for (const entry of leaderboard) {
    const participant = getState().participants.find((row) => row.number === entry.number);
    if (!participant) continue;
    const data = buildCertificate(participant, quest, entry.rank, leaderboard.length);
    if (data.code === code) return ok(data);
  }
  throw new MockError(404, 'not_found', 'We couldn’t find a certificate with this code.');
}
```

  - Register it with `{ method: 'GET', path: '/certificates/:code', handle: certificateByCode },`.

- [ ] **Step 5: `Certificate.tsx`**: replace the whole file:

```tsx
import { Download, Share2 } from 'lucide-react';
import type { CertificateData } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { downloadFile, isInsideTelegram, openExternalLink } from '@/lib/telegram';
import { useUiStore } from '@/stores/ui.store';

/**
 * The certificate is the PNG the API renders (spec §3) — the same file the bot
 * sent. One design, in one place (the satori template); nothing here styles it.
 */
export function Certificate({ data }: { data: CertificateData }) {
  const showToast = useUiStore((state) => state.showToast);
  const inTelegram = isInsideTelegram();
  const downloadUrl = `${data.imageUrl}?download=1`;
  const fileName = `BookQuest-${data.questYear}-certificate.png`;

  function download() {
    // Older Telegram clients lack downloadFile; the system viewer can still save an opened image.
    if (!downloadFile(downloadUrl, fileName)) openExternalLink(data.imageUrl);
  }

  async function share() {
    try {
      const blob = await (await fetch(data.imageUrl)).blob();
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My BookQuest certificate', url: data.verifyUrl });
        return;
      }
    } catch (error) {
      // The person closing the share sheet is not a failure worth a fallback.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    await navigator.clipboard.writeText(data.verifyUrl);
    showToast('Verification link copied.');
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <img
        src={data.imageUrl}
        width={1123}
        height={794}
        loading="lazy"
        alt={`Certificate for ${data.fullName}, BookQuest ${data.questYear}${data.placing ? `, place ${data.placing}` : ''}`}
        className="certificate-image"
      />
      <div className="flex flex-wrap gap-2">
        {inTelegram ? (
          <Button variant="gold" onClick={download}>
            <Download className="h-5 w-5" aria-hidden="true" /> Download
          </Button>
        ) : (
          <a href={downloadUrl} download={fileName} className="inline-flex min-h-[3.25rem] items-center gap-3 rounded-box bg-gold px-6 font-semibold text-[#170F09]">
            <Download className="h-5 w-5" aria-hidden="true" /> Download
          </a>
        )}
        {/* Telegram users share from the bot chat, where the photo already is. */}
        {!inTelegram && (
          <Button variant="quiet" onClick={() => void share()}>
            <Share2 className="h-5 w-5" aria-hidden="true" /> Share
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: CSS**:
  - In `results.css`, delete everything from the `/* ── Certificate ──` comment (line 131) to the end of the file. That's the `.certificate*` rules and the whole `@media print` block.
  - Then check `grep -rn "no-print\|certificate-print\|certificate__" apps/web/src` returns nothing.
  - In `profile.css`, after `.cert-slot`:

```css
/* The rendered certificate: a fixed-ratio image, never reflowed. */
.certificate-image {
  width: 100%;
  height: auto;
  border-radius: var(--radius-box);
  box-shadow: 0 18px 40px -24px rgb(0 0 0 / 0.8);
}
```

- [ ] **Step 7: Verify.** Run `pnpm typecheck`; the whole repo is green again. Then check in mock mode (`VITE_MOCK_API=true`):
  - Before `mockApi.publishResults()`, `/me` shows "Your certificate lands here".
  - After it, the mock image appears with Download and Share.
  - Download in a desktop browser saves a file. Share on desktop Chrome copies the verify link and shows the toast. On Android Chrome it opens the share sheet with the image.
  - Against the real API from Task 4, `/me` shows the real PNG. Then, in Telegram on iOS **and** Android, check that Download opens Telegram's download sheet. On a client too old for `downloadFile`, the image should open in the system viewer instead. Share should be hidden.
  - At 360 px wide, the image fits with no horizontal scroll.
  - `alt` text is announced (VoiceOver/TalkBack, or DevTools accessibility pane).

- [ ] **Step 8: Commit**: `feat(web): /me certificate is the rendered PNG — download in Telegram, share on the web`

---

### Task 7: Web — `/verify`

**Files:**
- Create: `apps/web/src/features/verify/VerifyPage.tsx`, `apps/web/src/features/verify/api/useVerifiedCertificate.ts`
- Modify: `apps/web/src/app/router.tsx`

- [ ] **Step 1: `features/verify/api/useVerifiedCertificate.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import type { CertificateData } from '@bookquest/shared';
import { api, isNotFound } from '@/lib/api/client';

export function useVerifiedCertificate(code: string | null) {
  return useQuery({
    queryKey: ['certificate', 'verify', code],
    queryFn: () => api.get<CertificateData>(`/certificates/${encodeURIComponent(code!)}`),
    enabled: code !== null,
    // A wrong code is an answer, not a blip worth retrying.
    retry: (count, error) => !isNotFound(error) && count < 2,
    staleTime: Infinity
  });
}
```

- [ ] **Step 2: `features/verify/VerifyPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BadgeCheck } from 'lucide-react';
import { normalizeCertificateCode } from '@bookquest/shared';
import { Screen } from '@/components/layout/Screen';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { isNotFound } from '@/lib/api/client';
import { formatLongDate } from '@/lib/format';
import { useVerifiedCertificate } from './api/useVerifiedCertificate';

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' } as const;

/** `/verify/:code` — what the QR code on paper opens. Public, works outside Telegram. */
export function VerifyPage() {
  const params = useParams();
  const navigate = useNavigate();
  const code = params.code ? normalizeCertificateCode(params.code) : null;
  const certificate = useVerifiedCertificate(code);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | undefined>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalised = normalizeCertificateCode(typed);
    if (!normalised) return setTypedError('Codes look like BQ4-K7M2QX.');
    setTypedError(undefined);
    navigate(`/verify/${normalised}`);
  }

  const form = (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
      <Field label="Certificate code" value={typed} onChange={(event) => setTyped(event.target.value)} message={typedError} status={typedError ? 'error' : undefined} autoCapitalize="characters" autoComplete="off" />
      <Button type="submit">Check</Button>
    </form>
  );

  if (params.code && code === null) {
    return (
      <Screen className="items-center gap-6">
        <p className="m-0 text-paper-dim">That isn’t a certificate code. Check it and try again.</p>
        {form}
      </Screen>
    );
  }
  if (!code) {
    return (
      <Screen className="items-center gap-6">
        <h1 className="type-display m-0 text-2xl text-paper">Check a certificate</h1>
        {form}
      </Screen>
    );
  }
  if (certificate.isPending) return <LoadingState label="Checking the certificate…" />;
  if (certificate.error) {
    if (isNotFound(certificate.error)) {
      return (
        <Screen className="items-center gap-6">
          <p className="m-0 text-paper-dim">We couldn’t find a certificate with the code {code}. Check it and try again.</p>
          {form}
        </Screen>
      );
    }
    return <ErrorState error={certificate.error} onRetry={() => certificate.refetch()} />;
  }

  const data = certificate.data;
  return (
    <Screen className="gap-5">
      <p className="m-0 flex items-center gap-2 text-lg font-semibold text-gold">
        <BadgeCheck className="h-6 w-6" aria-hidden="true" /> Genuine BookQuest certificate
      </p>
      <img src={data.imageUrl} width={1123} height={794} alt={`Certificate for ${data.fullName}`} className="certificate-image" />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-paper-dim">
        <dt>Name</dt><dd className="m-0 text-paper">{data.fullName}</dd>
        <dt>Edition</dt><dd className="m-0">{data.questEdition} · {data.questYear}</dd>
        <dt>Book</dt><dd className="m-0">{data.bookTitle} by {data.bookAuthor}</dd>
        {data.placing && (<><dt>Place</dt><dd className="m-0 text-paper">{ORDINAL[data.placing]}</dd></>)}
        <dt>Participant</dt><dd className="m-0">№ {data.participantNumber}</dd>
        <dt>Issued</dt><dd className="m-0">{formatLongDate(data.issuedAt)}</dd>
        <dt>Code</dt><dd className="m-0 font-semibold tracking-wide">{data.code}</dd>
      </dl>
    </Screen>
  );
}
```

Check `ErrorState`'s real props (`grep -n "export function ErrorState" -A8 apps/web/src/components/feedback/ErrorState.tsx`) and match them. The `onRetry`/`error` names above are assumptions. Do the same for `Field`'s `status` values.

- [ ] **Step 3: Router**: import `VerifyPage` and, in the public block after `/results`:

```tsx
      // What the QR code on a printed certificate opens — public, no session.
      { path: '/verify', element: <VerifyPage /> },
      { path: '/verify/:code', element: <VerifyPage /> },
```

- [ ] **Step 4: Verify.** Run `pnpm typecheck`. Then check:
  - In mock mode, `/verify` shows the input. Entering `bq4 …` (the mock code, lowercase with a space) navigates to the canonical `/verify/BQ4-…` and shows "Genuine" with the facts.
  - A rank-4 code shows no Place row.
  - `/verify/BQ4-ZZZZZZ` shows the not-found copy with the input. `/verify/hello` shows "That isn't a certificate code".
  - Against the real API, scan a printed real certificate's QR code (Task 5) with a phone: it opens this page in the phone's browser, **outside** Telegram, signed out.
  - At 360 px wide there's no horizontal scroll, and the `dl` wraps cleanly.
  - The tab bar doesn't highlight any tab.

- [ ] **Step 5: Commit**: `feat(web): public /verify page for certificate codes`

---

### Task 8: Web — admin Certificates panel

**Files:**
- Create: `apps/web/src/features/admin/api/useCertificateDelivery.ts`, `apps/web/src/features/admin/certificates/previewUrl.ts`, `apps/web/src/features/admin/certificates/CertificatesPanel.tsx`
- Modify: `apps/web/src/features/admin/api/adminKeys.ts`, `apps/web/src/features/admin/ResultsInspectionPage.tsx`, `apps/web/src/lib/api/mock/routes.ts`

- [ ] **Step 1: Keys**: in `adminKeys`, add `certificateDelivery: () => [...adminKeys.all, 'certificateDelivery'] as const,`.

- [ ] **Step 2: `api/useCertificateDelivery.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CertificateDelivery } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

const POLL_MS = 2000;

export function useCertificateDelivery() {
  return useQuery({
    queryKey: adminKeys.certificateDelivery(),
    queryFn: () => api.get<CertificateDelivery>('/admin/certificates/delivery'),
    // Same rule as broadcasts: poll only while a send is running.
    refetchInterval: (query) => (query.state.data?.status === 'sending' ? POLL_MS : false)
  });
}

export function useSendCertificates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<CertificateDelivery>('/admin/certificates/send', {}),
    onSuccess: (data) => queryClient.setQueryData(adminKeys.certificateDelivery(), data)
  });
}
```

- [ ] **Step 3: `certificates/previewUrl.ts`**

```ts
import type { CertificateTier } from '@bookquest/shared';

const isMock = import.meta.env.VITE_MOCK_API === 'true' || import.meta.env.VITE_MOCK_API === '1';

/** Public sample images (fixed data, stamped SAMPLE). `<img>` can't send a token, so these aren't admin-only. */
export async function certificatePreviewUrl(tier: CertificateTier): Promise<string> {
  if (isMock) return (await import(`@/assets/certificates/${tier}.svg`)).default as string;
  return `${import.meta.env.VITE_API_URL}/certificates/preview/${tier}.png`;
}
```

If Vite's dynamic-import warning about a variable path bothers you, replace it with a static map of the four imports, as in the mock's `MOCK_ART`.

- [ ] **Step 4: `certificates/CertificatesPanel.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { CERTIFICATE_TIERS, type CertificateTier } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Rule } from '@/components/ui/Rule';
import { formatCount } from '@/lib/format';
import { useUiStore } from '@/stores/ui.store';
import { useCertificateDelivery, useSendCertificates } from '../api/useCertificateDelivery';
import { certificatePreviewUrl } from './previewUrl';

const TIER_LABEL: Record<CertificateTier, string> = { gold: '1st', silver: '2nd', bronze: '3rd', participant: 'Everyone else' };

function Preview({ tier }: { tier: CertificateTier }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    void certificatePreviewUrl(tier).then(setSrc);
  }, [tier]);
  return (
    <figure className="m-0 flex flex-col gap-1">
      {src ? <img src={src} width={1123} height={794} alt={`Sample ${TIER_LABEL[tier]} certificate`} className="certificate-image" loading="lazy" /> : <div className="aspect-[1123/794] rounded-box bg-ash" />}
      <figcaption className="text-sm text-taupe">{TIER_LABEL[tier]}</figcaption>
    </figure>
  );
}

export function CertificatesPanel() {
  const delivery = useCertificateDelivery();
  const send = useSendCertificates();
  const showToast = useUiStore((state) => state.showToast);
  const [confirming, setConfirming] = useState(false);
  const d = delivery.data;

  const sending = d?.status === 'sending';
  const done = d !== undefined && d.pending === 0 && d.total > 0;
  const processed = d ? d.total - d.pending : 0;

  return (
    <section className="flex flex-col gap-3">
      <p className="type-label m-0">Certificates</p>
      <Rule />
      <div className="grid grid-cols-2 gap-3">
        {CERTIFICATE_TIERS.map((tier) => <Preview key={tier} tier={tier} />)}
      </div>

      {d && (
        <p className="m-0 text-paper-dim" aria-live="polite">
          {d.status === 'idle' && `${formatCount(d.total)} finishers have not been sent their certificate yet.`}
          {sending && `Sending… ${formatCount(processed)} of ${formatCount(d.total)}`}
          {!sending && d.status !== 'idle' &&
            `${formatCount(d.delivered)} delivered in Telegram · ${formatCount(d.inAppOnly)} in-app only · ${formatCount(d.blocked)} blocked the bot${d.failed > 0 ? ` · ${formatCount(d.failed)} failed — send again to retry` : ''}`}
          {d.status === 'interrupted' && ' The last send was interrupted — press Send to finish it.'}
        </p>
      )}
      {sending && d && <progress className="w-full" max={d.total} value={processed} />}

      <Button variant="gold" disabled={!d || sending || done || send.isPending} onClick={() => setConfirming(true)}>
        {done ? 'All certificates sent' : 'Send certificates'}
      </Button>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Send to ${formatCount(d?.pending ?? 0)} finishers?`}
        actions={
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              variant="gold"
              disabled={send.isPending}
              onClick={() =>
                send.mutate(undefined, {
                  onSuccess: () => showToast('Certificates on their way.'),
                  onError: (error) => showToast(error.message),
                  onSettled: () => setConfirming(false)
                })
              }
            >
              Send
            </Button>
          </>
        }
      >
        <p className="m-0 text-paper-dim">
          {formatCount(d?.pendingReachable ?? 0)} get it in Telegram, the rest in the app. Everyone can download it from their profile. This can’t be undone.
        </p>
      </Sheet>
    </section>
  );
}
```

Match the `Sheet` `actions` prop to its real signature (`grep -n "interface SheetProps" -A8 apps/web/src/components/ui/Sheet.tsx`). Use the same pattern as `BroadcastPage`.

- [ ] **Step 5: Mount**: in `ResultsInspectionPage.tsx`, render `<CertificatesPanel />` after the leaderboard section, inside the `leaderboard.length > 0` branch, because with no finishers there's nothing to send.

- [ ] **Step 6: Mock**: in `mock/routes.ts`, keep a module-level `let mockDelivery: 'idle' | 'sent' = 'idle'`, then:

```ts
  {
    method: 'GET',
    path: '/admin/certificates/delivery',
    handle: (context) => {
      requireAdmin(context);
      const total = quizTakers(getState()).length;
      const sent = mockDelivery === 'sent';
      return ok({ status: mockDelivery, total, delivered: sent ? Math.round(total * 0.8) : 0, inAppOnly: sent ? total - Math.round(total * 0.8) : 0, blocked: 0, failed: 0, pending: sent ? 0 : total, pendingReachable: sent ? 0 : Math.round(total * 0.8), startedAt: sent ? new Date().toISOString() : null, completedAt: sent ? new Date().toISOString() : null });
    }
  },
  {
    method: 'POST',
    path: '/admin/certificates/send',
    handle: (context) => {
      requireAdmin(context);
      mockDelivery = 'sent';
      return ok({ status: 'sending', total: quizTakers(getState()).length, delivered: 0, inAppOnly: 0, blocked: 0, failed: 0, pending: quizTakers(getState()).length, pendingReachable: 0, startedAt: new Date().toISOString(), completedAt: null });
    }
  },
```

`mockApi.reset()` should also reset `mockDelivery`. If the store owns reset, move the flag into `MockState` instead.

- [ ] **Step 7: Verify.** Run `pnpm typecheck`. Then check:
  - In mock mode as admin, after `publishResults()`, `/admin/results` shows four sample previews in a 2 × 2 grid, the status line, and **Send certificates**.
  - Confirm: the toast appears, the status line switches to the delivered summary, and the button reads "All certificates sent" and is disabled.
  - Against the real API on the Task 5 seed, the four previews are real `SAMPLE` PNGs. The confirm sheet's numbers match `GET /admin/certificates/delivery`. During a send the bar advances about every 2 s, and the Network tab shows polling stopping once the send is `sent`.
  - Reload mid-send: polling resumes.
  - At 360 px wide the grid and the sheet fit.

- [ ] **Step 8: Commit**: `feat(web): admin Certificates panel — previews, confirm, live delivery progress`

---

### Task 9: Spec sync and final pass

**Files:**
- Modify: `docs/superpowers/specs/2026-11-10-certificates-design.md`, `docs/BACKEND-SPEC.md`, `docs/FRONTEND-SPEC.md`

- [ ] **Step 1:** In the certificates spec, record the refinements listed at the top of this plan: the existing `PUBLIC_API_URL`, `WEB_APP_URL` enforced at send time, `CertificateData` shared by `/me` and verify, the public sample previews, retrying failed DMs, and `certificateNotifiedAt`.
- [ ] **Step 2:** In `BACKEND-SPEC.md` and `FRONTEND-SPEC.md`:
  - Replace the `CertificateData` interface with the Task 1 shape.
  - Mark `GET /participants/me/certificate` ✅.
  - Add `GET /certificates/:code`, `GET /certificates/:code/image.png`, `GET /certificates/preview/:sample.png`, `POST /admin/certificates/send` and `GET /admin/certificates/delivery`.
  - Mark TBD-3 resolved (server-rendered PNG, satori).
- [ ] **Step 3:** Run `pnpm typecheck` and `pnpm build` across the monorepo. Both must pass.
- [ ] **Step 4:** Run `grep -rn "logger\.\(info\|warn\|error\)" apps/api/src/services/certificate*.ts apps/api/src/certificates apps/api/src/utils/telegram-send.ts` and read each call. None may log `fullName`, a caption or a notification body.
- [ ] **Step 5:** Rollout order:
  1. Set `WEB_APP_URL` and `PUBLIC_API_URL` in production.
  2. Deploy the API (Tasks 2–5). The new fields default to null, so no migration is needed.
  3. Deploy the web app (Tasks 6–8).
  4. On results day, an organiser previews the samples, then presses **Send certificates**.
- [ ] **Step 6: Commit**: `docs(spec): sync certificates spec and API contract with the implementation`

---

## Later: when the design arrives (spec §8)

Not a task in this plan. Recorded so the hand-off is obvious:
1. Convert the design to `apps/api/src/certificates/template.tsx` under the satori rules in that file's header comment. If the design uses other fonts, add their `.woff` files to `FONTS` in `render.ts`.
2. Bump `TEMPLATE_VERSION`.
3. Render all six samples (Task 3 Step 6 script, or `/certificates/preview/*.png`), including `long` and `cyrillic`.
4. Replace the four mock SVGs in `apps/web/src/assets/certificates/` with exports of the new design, so mock mode looks right.
