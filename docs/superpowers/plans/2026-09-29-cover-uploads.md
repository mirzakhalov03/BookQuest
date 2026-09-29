# Cover Uploads (GridFS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins pick a cover image file in the quest editor. The API stores it in MongoDB GridFS and serves it back at a stable URL that goes into `book.coverUrl`.

**Architecture:** A `covers` GridFS bucket on the existing Mongoose connection. `POST /api/v1/admin/covers` (multer, memory storage) sniffs the real image type and stores the file. It returns `{ url }` built from `PUBLIC_API_URL`. `GET /api/v1/covers/:id` streams the file with immutable caching and a cross-origin CORP header. The web `CoverPicker` uploads on pick and writes the URL into the existing form state, so quest save is unchanged. Limits and copy live in `@bookquest/shared`, so API and web can't drift apart.

**Tech Stack:** Express 5 + TypeScript, Mongoose 9 (`mongoose.mongo.GridFSBucket`), multer 2, Zod 4; React + Vite + Tailwind, React Query, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-29-cover-uploads-design.md`

## Global Constraints

- Max size **5 MB** (`5 * 1024 * 1024` bytes); accepted types exactly `image/jpeg`, `image/png`, `image/webp`.
- The real type is decided by magic bytes on the server; the client-declared mimetype is never trusted.
- `coverUrl` for an uploaded cover = `${PUBLIC_API_URL}/api/v1/covers/<24-hex id>` (absolute). The shared `coverUrl` Zod schema is **not** changed.
- Serving headers: `Cache-Control: public, max-age=31536000, immutable` and `Cross-Origin-Resource-Policy: cross-origin`.
- User-facing copy (identical in browser and server): `"That file is over 5MB."`, `"Only JPEG, PNG or WebP images."`, `"Choose an image to upload."`
- Replaced covers are deleted best effort, after the quest update succeeds; a failed delete never fails the save.
- Per the user's CLAUDE.md, **no automated tests**. Each task is verified with `pnpm typecheck` plus the manual/`curl` checks listed in it.
- Backend naming: `*.routes.ts`, `*.controllers.ts`, `*.services.ts`, `*.middleware.ts`. Comments are one-liners explaining *why*.
- Commits end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only the files each task names (the working tree has unrelated uncommitted changes).

## Review Focus

1. **Cover shown on the web app's origin.** If `Cross-Origin-Resource-Policy: cross-origin` is missing, the request returns 200 but the `<img>` stays blank. Task 2 Step 6 checks the header explicitly.
2. **Multipart `Content-Type`.** If `client.ts` sets `Content-Type` on a `FormData` body, multer sees no boundary and answers "Choose an image to upload." Task 4 Step 5 checks the request header in DevTools.
3. **A file renamed to `.jpg` that isn't an image.** It must be rejected with 400 "Only JPEG, PNG or WebP images." Task 2 Step 6 uploads a renamed text file.
4. **Malformed or unknown cover id.** `GET /covers/nope` and `GET /covers/<valid but missing id>` must both 404 and must not crash the stream. Task 2 Step 6 covers both.
5. **Save during an in-flight upload.** Save must stay disabled until the upload settles. Otherwise the quest saves with the old cover. Task 5 Step 6 checks this with network throttling.

---

## File Structure

```
packages/shared/src/constants/cover.ts          new   — limits, accepted types, copy, CoverUpload type
packages/shared/src/constants/index.ts          mod   — re-export cover

apps/api/src/config/env.ts                      mod   — PUBLIC_API_URL + publicApiUrl + prod warning
apps/api/src/utils/mongo.ts                     mod   — OBJECT_ID_PATTERN
apps/api/src/utils/image-type.ts                new   — magic-byte sniffing
apps/api/src/utils/audit.ts                     new   — admin audit log line (moved from quest controller)
apps/api/src/validators/admin.validators.ts     mod   — use OBJECT_ID_PATTERN
apps/api/src/middlewares/upload.middleware.ts   new   — multer config + error translation
apps/api/src/services/cover.services.ts         new   — bucket, upload, open, discard, coverIdFromUrl
apps/api/src/controllers/cover.controllers.ts   new   — uploadCover, getCover
apps/api/src/controllers/admin/quest.controllers.ts  mod — use utils/audit
apps/api/src/routes/cover.routes.ts             new   — GET /:id
apps/api/src/routes/admin/cover.routes.ts       new   — POST /
apps/api/src/routes/index.ts                    mod   — mount /covers
apps/api/src/routes/admin/index.ts              mod   — mount /covers
apps/api/src/services/quest.services.ts         mod   — discard replaced cover

apps/web/src/lib/api/client.ts                  mod   — FormData bodies + api.upload
apps/web/src/lib/api/mock/transport.ts          mod   — read multipart bodies
apps/web/src/lib/api/mock/routes.ts             mod   — POST /admin/covers
apps/web/src/features/admin/api/useUploadCover.ts        new
apps/web/src/features/admin/components/CoverPicker.tsx   new
apps/web/src/features/admin/components/BookFieldsSection.tsx  mod — swap Field for CoverPicker
apps/web/src/features/admin/QuestEditorPage.tsx          mod — disable save while uploading
```

Small refinements over the spec's file list, same behavior:
- `OBJECT_ID_PATTERN` lives in `utils/mongo.ts` instead of a new `common.validators.ts`, because the cover service needs it too, and services shouldn't import validators.
- Limits and copy move to `@bookquest/shared`.
- `uploadedBy` stores the user's Mongo id, which every account has. Telegram id is null for phone accounts.

---

### Task 1: Shared cover constants

**Files:**
- Create: `packages/shared/src/constants/cover.ts`
- Modify: `packages/shared/src/constants/index.ts`

**Interfaces:**
- Produces: `COVER_MAX_BYTES: number`, `COVER_CONTENT_TYPES: readonly ['image/jpeg','image/png','image/webp']`, `type CoverContentType`, `COVER_MESSAGES: { tooLarge; wrongType; missing }`, `interface CoverUpload { url: string }`, all exported from `@bookquest/shared`.

- [ ] **Step 1: Create the constants file**

`packages/shared/src/constants/cover.ts`:

```ts
/** One source for cover limits and copy, so the browser pre-check and the API always agree. */
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

export const COVER_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type CoverContentType = (typeof COVER_CONTENT_TYPES)[number];

export const COVER_MESSAGES = {
  tooLarge: 'That file is over 5MB.',
  wrongType: 'Only JPEG, PNG or WebP images.',
  missing: 'Choose an image to upload.'
} as const;

/** `POST /admin/covers` response data. */
export interface CoverUpload {
  url: string;
}
```

- [ ] **Step 2: Re-export it**

Append to `packages/shared/src/constants/index.ts`:

```ts
export * from './cover.js';
```

- [ ] **Step 3: Build shared and typecheck**

Run: `pnpm --filter @bookquest/shared build && pnpm --filter @bookquest/shared typecheck`
Expected: exits 0; `packages/shared/dist/constants/cover.js` exists.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants/cover.ts packages/shared/src/constants/index.ts
git commit -m "feat(shared): cover upload limits and copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: API — upload and serve covers

**Files:**
- Modify: `apps/api/package.json` (via pnpm add)
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/utils/mongo.ts`
- Create: `apps/api/src/utils/image-type.ts`
- Create: `apps/api/src/utils/audit.ts`
- Modify: `apps/api/src/validators/admin.validators.ts:4`
- Modify: `apps/api/src/controllers/admin/quest.controllers.ts`
- Create: `apps/api/src/middlewares/upload.middleware.ts`
- Create: `apps/api/src/services/cover.services.ts`
- Create: `apps/api/src/controllers/cover.controllers.ts`
- Create: `apps/api/src/routes/cover.routes.ts`
- Create: `apps/api/src/routes/admin/cover.routes.ts`
- Modify: `apps/api/src/routes/index.ts`
- Modify: `apps/api/src/routes/admin/index.ts`

**Interfaces:**
- Consumes: `COVER_MAX_BYTES`, `COVER_CONTENT_TYPES`, `CoverContentType`, `COVER_MESSAGES`, `CoverUpload` from Task 1.
- Produces (used by Task 3): from `services/cover.services.ts`:
  - `coverIdFromUrl(url: string | null): string | null`
  - `discardCover(id: string): Promise<void>` (never rejects)
- Produces (used by Task 4): HTTP `POST /api/v1/admin/covers` (multipart field `file`) → `201 { ok: true, data: CoverUpload }`.

- [ ] **Step 1: Install multer**

Run: `pnpm --filter @bookquest/api add multer && pnpm --filter @bookquest/api add -D @types/multer`
Expected: both added to `apps/api/package.json`.

- [ ] **Step 2: Env + small utils**

In `apps/api/src/config/env.ts`, add to `envSchema` directly after `WEB_APP_URL`:

```ts
  /** Absolute base of this API as browsers reach it — uploaded cover URLs are built from it. */
  PUBLIC_API_URL: z.string().url().optional()
```

(Add the trailing comma to the `WEB_APP_URL` line.) Then, after the `corsOrigins` export:

```ts
/** Baked into stored cover URLs, so it must be the address browsers use, not an internal one. */
export const publicApiUrl = (env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`).replace(/\/+$/, '');
```

And at the end of the file:

```ts
if (isProduction && !env.PUBLIC_API_URL) {
  configWarnings.push(
    'PUBLIC_API_URL is not set — uploaded cover URLs will point at localhost. Set it to the API\'s public origin.'
  );
}
```

Append to `apps/api/src/utils/mongo.ts`:

```ts
/** A 24-hex ObjectId string. Stricter than `ObjectId.isValid`, which also accepts any 12-char string. */
export const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
```

In `apps/api/src/validators/admin.validators.ts`, add `import { OBJECT_ID_PATTERN } from '../utils/mongo.js';` and replace line 4 with:

```ts
const objectId = z.string().regex(OBJECT_ID_PATTERN, 'That is not a valid id.');
```

Create `apps/api/src/utils/image-type.ts`:

```ts
import type { CoverContentType } from '@bookquest/shared';

/** The file's own first bytes decide its type — the client-declared mimetype is just a claim. */
export function detectImageType(buffer: Buffer): CoverContentType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}
```

Create `apps/api/src/utils/audit.ts` (moved verbatim in spirit from `admin/quest.controllers.ts`, now shared by two controllers):

```ts
import type { Request } from 'express';
import { logger } from '../config/logger.js';
import { currentUser } from '../middlewares/auth.middleware.js';

/**
 * Two admins at low volume do not justify an audit collection. What they do
 * justify is knowing who changed what: the acting Telegram id, the action, and
 * the keys touched — never the values, which can contain anything.
 */
export function auditAdmin(req: Request, action: string, detail: Record<string, unknown>): void {
  logger.info({ actor: currentUser(req).telegramUserId, action, ...detail }, 'Admin action');
}
```

In `apps/api/src/controllers/admin/quest.controllers.ts`: delete the local `audit` function and its doc comment (lines 32–39), remove the now-unused `logger` and `currentUser` imports, add `import { auditAdmin } from '../../utils/audit.js';`, and rename the three `audit(` calls to `auditAdmin(`.

- [ ] **Step 3: Upload middleware**

Create `apps/api/src/middlewares/upload.middleware.ts`:

```ts
import type { RequestHandler } from 'express';
import multer from 'multer';
import { COVER_MAX_BYTES, COVER_MESSAGES } from '@bookquest/shared';
import { ApiError } from '../utils/api-error.js';

// Memory storage: covers are ≤5MB and go straight to GridFS, so a temp file would only add cleanup.
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COVER_MAX_BYTES, files: 1 }
}).single('file');

/** Parses one `file` field and turns multer's errors into the API's own envelope. */
export const uploadCoverFile: RequestHandler = (req, res, next) => {
  coverUpload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new ApiError(413, 'validation_failed', COVER_MESSAGES.tooLarge, { file: COVER_MESSAGES.tooLarge }));
      return;
    }
    if (error || !req.file) {
      next(ApiError.badRequest(COVER_MESSAGES.missing, { file: COVER_MESSAGES.missing }));
      return;
    }
    next();
  });
};
```

- [ ] **Step 4: Cover service**

Create `apps/api/src/services/cover.services.ts`:

```ts
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';
import { COVER_MESSAGES, type CoverUpload } from '@bookquest/shared';
import { publicApiUrl } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/api-error.js';
import { detectImageType } from '../utils/image-type.js';
import { OBJECT_ID_PATTERN } from '../utils/mongo.js';

const { GridFSBucket, ObjectId } = mongoose.mongo;
const COVER_URL_PREFIX = `${publicApiUrl}/api/v1/covers/`;

let bucket: InstanceType<typeof GridFSBucket> | null = null;

// Lazy: the connection's `db` only exists after connectToDatabase() resolves.
function coversBucket(): InstanceType<typeof GridFSBucket> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  bucket ??= new GridFSBucket(db, { bucketName: 'covers' });
  return bucket;
}

export async function uploadCover(
  file: { buffer: Buffer; originalname: string },
  uploadedBy: string
): Promise<CoverUpload & { id: string }> {
  const contentType = detectImageType(file.buffer);
  if (!contentType) {
    throw ApiError.badRequest(COVER_MESSAGES.wrongType, { file: COVER_MESSAGES.wrongType });
  }

  const upload = coversBucket().openUploadStream(file.originalname, {
    metadata: { contentType, uploadedBy }
  });
  await pipeline(Readable.from(file.buffer), upload);

  const id = upload.id.toString();
  return { id, url: `${COVER_URL_PREFIX}${id}` };
}

/** A malformed id is reported as missing, so ids can't be probed by format. */
export async function openCover(id: string) {
  if (!OBJECT_ID_PATTERN.test(id)) throw ApiError.notFound('No such cover.');

  const _id = new ObjectId(id);
  const [file] = await coversBucket().find({ _id }).limit(1).toArray();
  if (!file) throw ApiError.notFound('No such cover.');

  return {
    contentType: String(file.metadata?.contentType ?? 'application/octet-stream'),
    length: file.length,
    stream: coversBucket().openDownloadStream(_id)
  };
}

/** Our own cover's id from a stored `coverUrl`; `null` for pasted external URLs. */
export function coverIdFromUrl(url: string | null): string | null {
  if (!url?.startsWith(COVER_URL_PREFIX)) return null;
  const id = url.slice(COVER_URL_PREFIX.length);
  return OBJECT_ID_PATTERN.test(id) ? id : null;
}

/** Best effort: an orphaned few-KB file is not worth failing a quest save over. */
export async function discardCover(id: string): Promise<void> {
  try {
    await coversBucket().delete(new ObjectId(id));
  } catch (error) {
    logger.warn({ err: error, coverId: id }, 'Could not delete replaced cover');
  }
}
```

- [ ] **Step 5: Controller + routes**

Create `apps/api/src/controllers/cover.controllers.ts`:

```ts
import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import * as coverService from '../services/cover.services.js';
import { logger } from '../config/logger.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { auditAdmin } from '../utils/audit.js';
import { ok } from '../utils/respond.js';

/** POST /api/v1/admin/covers — `req.file` is guaranteed by `uploadCoverFile`. */
export async function uploadCover(req: Request, res: Response): Promise<void> {
  const cover = await coverService.uploadCover(req.file!, currentUser(req).id);
  auditAdmin(req, 'upload-cover', { coverId: cover.id });
  ok(res, { url: cover.url }, 201);
}

/** GET /api/v1/covers/:id */
export async function getCover(req: Request, res: Response): Promise<void> {
  const cover = await coverService.openCover((req.params as { id: string }).id);

  res.set({
    'Content-Type': cover.contentType,
    'Content-Length': String(cover.length),
    // A new cover is a new id, so a cached copy can never go stale.
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Helmet defaults to same-origin, which makes browsers blank the image on the web app's origin.
    'Cross-Origin-Resource-Policy': 'cross-origin'
  });

  try {
    await pipeline(cover.stream, res);
  } catch (error) {
    // Once bytes are out, the error middleware can't send an envelope; pipeline already closed the socket.
    if (!res.headersSent) throw error;
    logger.warn({ err: error }, 'Cover stream failed mid-response');
  }
}
```

Create `apps/api/src/routes/cover.routes.ts`:

```ts
import { Router } from 'express';
import * as coverController from '../controllers/cover.controllers.js';

export const coverRoutes: Router = Router();

coverRoutes.get('/:id', coverController.getCover);
```

Create `apps/api/src/routes/admin/cover.routes.ts`:

```ts
import { Router } from 'express';
import * as coverController from '../../controllers/cover.controllers.js';
import { uploadCoverFile } from '../../middlewares/upload.middleware.js';

export const adminCoverRoutes: Router = Router();

adminCoverRoutes.post('/', uploadCoverFile, coverController.uploadCover);
```

In `apps/api/src/routes/index.ts`: add `import { coverRoutes } from './cover.routes.js';` and, after the `/quests` line, `apiRoutes.use('/covers', coverRoutes);`.

In `apps/api/src/routes/admin/index.ts`: add `import { adminCoverRoutes } from './cover.routes.js';` and, after the `/broadcasts` line, `adminRoutes.use('/covers', adminCoverRoutes);`.

- [ ] **Step 6: Typecheck and verify with curl**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: exits 0.

Start the API (`pnpm --filter @bookquest/api dev`). Get an admin token (sign in as an admin in the web app and copy the bearer token from DevTools → any `/api/v1` request → `Authorization`). Then:

```bash
export T=<admin token>; export A=http://localhost:4000/api/v1
curl -s -F file=@some-cover.jpg -H "Authorization: Bearer $T" $A/admin/covers
```
Expected: `{"ok":true,"data":{"url":"http://localhost:4000/api/v1/covers/<24hex>"}}`

```bash
curl -sI <that url>
```
Expected: `200`, `content-type: image/jpeg`, `cache-control: public, max-age=31536000, immutable`, `cross-origin-resource-policy: cross-origin`.

```bash
echo hello > fake.jpg && curl -s -F file=@fake.jpg -H "Authorization: Bearer $T" $A/admin/covers
```
Expected: 400, `"Only JPEG, PNG or WebP images."`

```bash
head -c 6000000 /dev/urandom > big.jpg && curl -s -o /dev/null -w '%{http_code}\n' -F file=@big.jpg -H "Authorization: Bearer $T" $A/admin/covers
```
Expected: `413`

```bash
curl -s -H "Authorization: Bearer $T" -X POST $A/admin/covers                # no file → 400 "Choose an image to upload."
curl -s -F file=@some-cover.jpg $A/admin/covers                               # no token → 401
curl -s -o /dev/null -w '%{http_code}\n' $A/covers/nope                       # 404
curl -s -o /dev/null -w '%{http_code}\n' $A/covers/000000000000000000000000   # 404
```

The API process must still be running after all of the above.

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/config/env.ts apps/api/src/utils/mongo.ts \
  apps/api/src/utils/image-type.ts apps/api/src/utils/audit.ts apps/api/src/validators/admin.validators.ts \
  apps/api/src/controllers/admin/quest.controllers.ts apps/api/src/middlewares/upload.middleware.ts \
  apps/api/src/services/cover.services.ts apps/api/src/controllers/cover.controllers.ts \
  apps/api/src/routes/cover.routes.ts apps/api/src/routes/admin/cover.routes.ts \
  apps/api/src/routes/index.ts apps/api/src/routes/admin/index.ts
git commit -m "feat(api): upload covers to GridFS and serve them with immutable caching

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: API — delete a replaced cover

**Files:**
- Modify: `apps/api/src/services/quest.services.ts` (imports, `updateQuest` ~lines 93–133)

**Interfaces:**
- Consumes: `coverIdFromUrl`, `discardCover` from Task 2.

- [ ] **Step 1: Import the helpers**

Add to the imports in `apps/api/src/services/quest.services.ts`:

```ts
import { coverIdFromUrl, discardCover } from './cover.services.js';
```

- [ ] **Step 2: Remember the old cover before updating, discard after**

In `updateQuest`, directly after the `if (issues) throw badDates(issues);` line, add:

```ts
  // Only when the cover actually changes, and only if the old one is ours — pasted URLs aren't ours to delete.
  const replacedCoverId =
    payload.book && 'coverUrl' in payload.book && payload.book.coverUrl !== quest.book.coverUrl
      ? coverIdFromUrl(quest.book.coverUrl)
      : null;
```

Replace the function's last two lines:

```ts
  if (!updated) throw ApiError.notFound('No such quest.');
  return toQuestDto(updated);
```

with:

```ts
  if (!updated) throw ApiError.notFound('No such quest.');
  if (replacedCoverId) await discardCover(replacedCoverId);
  return toQuestDto(updated);
```

- [ ] **Step 3: Typecheck and verify**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: exits 0.

With the API running, upload two covers (Task 2 Step 6 curl), then:

```bash
Q=<current quest id from GET $A/quests/current → data.id>
curl -s -X PATCH -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"book":{"coverUrl":"<url 1>"}}' $A/admin/quests/$Q
curl -s -X PATCH -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"book":{"coverUrl":"<url 2>"}}' $A/admin/quests/$Q
curl -s -o /dev/null -w '%{http_code}\n' "<url 1>"   # 404 — replaced cover deleted
curl -s -o /dev/null -w '%{http_code}\n' "<url 2>"   # 200
curl -s -X PATCH -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"book":{"coverUrl":null}}' $A/admin/quests/$Q
curl -s -o /dev/null -w '%{http_code}\n' "<url 2>"   # 404 — removed cover deleted
```

Also PATCH an unrelated field (e.g. `{"book":{"pages":200}}`) while a cover is set, and confirm the cover URL still returns 200.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/quest.services.ts
git commit -m "feat(api): delete a quest's old cover when it is replaced or removed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Web — upload plumbing (client, hook, mock)

**Files:**
- Modify: `apps/web/src/lib/api/client.ts` (`send()`, `api` object)
- Create: `apps/web/src/features/admin/api/useUploadCover.ts`
- Modify: `apps/web/src/lib/api/mock/transport.ts` (`readBody`)
- Modify: `apps/web/src/lib/api/mock/routes.ts` (new handler + route table)

**Interfaces:**
- Consumes: `CoverUpload` from Task 1; HTTP contract from Task 2.
- Produces (used by Task 5): `api.upload<T>(path: string, form: FormData): Promise<T>`; `useUploadCover()` → a React Query mutation whose `mutate(file: File, callbacks)` resolves to `CoverUpload`.

- [ ] **Step 1: Teach `send()` about FormData**

In `apps/web/src/lib/api/client.ts`, replace the body of `send()` with:

```ts
  const { body, headers, ...rest } = options;
  // The browser must write the multipart boundary itself, so FormData gets no Content-Type from us.
  const isForm = body instanceof FormData;

  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      // Free-tier ngrok shows a "Visit Site" interstitial to any request with a
      // real browser User-Agent — which the Telegram WebView always sends — and
      // that page has no CORS headers, so fetch() fails before a response ever
      // arrives. This header is ngrok's own opt-out; harmless off-tunnel.
      'ngrok-skip-browser-warning': 'true',
      ...headers
    },
    ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) })
  });
```

Add to the `api` object, after `patch`:

```ts
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form })
```

(Add a trailing comma to the `patch` line.)

- [ ] **Step 2: The upload hook**

Create `apps/web/src/features/admin/api/useUploadCover.ts`:

```ts
import { useMutation } from '@tanstack/react-query';
import type { CoverUpload } from '@bookquest/shared';
import { api } from '@/lib/api/client';

/** `POST /admin/covers`. No cache to touch — the URL only matters once the quest is saved. */
export function useUploadCover() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.upload<CoverUpload>('/admin/covers', form);
    }
  });
}
```

- [ ] **Step 3: Mock transport reads multipart**

In `apps/web/src/lib/api/mock/transport.ts`, in `readBody`, directly after the `GET`/`HEAD` early return, add:

```ts
  if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
    return request.formData();
  }
```

- [ ] **Step 4: Mock route**

In `apps/web/src/lib/api/mock/routes.ts`, add this handler just above the `/* ── Table ── */` comment:

```ts
/** A session-lived blob URL stands in for the GridFS URL — enough for the picker to work end to end. */
function uploadCover(context: Context): Result {
  requireAdmin(context);

  const file = context.body instanceof FormData ? context.body.get('file') : null;
  if (!(file instanceof File)) {
    throw new MockError(400, 'validation_failed', 'Choose an image to upload.', {
      file: 'Choose an image to upload.'
    });
  }
  return created({ url: URL.createObjectURL(file) });
}
```

In the `routes` table, after `{ method: 'GET', path: '/admin/stats', handle: adminStats },`, add:

```ts
  { method: 'POST', path: '/admin/covers', handle: uploadCover },
```

- [ ] **Step 5: Typecheck and verify the request shape**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: exits 0.

JSON regression check: with the web app running, save a small edit in the admin quest editor. In DevTools → Network, the `PATCH` still sends `Content-Type: application/json` and succeeds. The multipart path is checked through the UI in Task 5 Step 6. Nothing calls `api.upload` yet.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/client.ts apps/web/src/features/admin/api/useUploadCover.ts \
  apps/web/src/lib/api/mock/transport.ts apps/web/src/lib/api/mock/routes.ts
git commit -m "feat(web): multipart uploads in the API client, cover upload hook and mock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Web — CoverPicker in the quest editor

**Files:**
- Create: `apps/web/src/features/admin/components/CoverPicker.tsx`
- Modify: `apps/web/src/features/admin/components/BookFieldsSection.tsx`
- Modify: `apps/web/src/features/admin/QuestEditorPage.tsx` (~lines 61–79, 115–119)

**Interfaces:**
- Consumes: `useUploadCover()` from Task 4; `COVER_CONTENT_TYPES`, `COVER_MAX_BYTES`, `COVER_MESSAGES` from Task 1; `ApiRequestError` from `@/lib/api/client`; existing `Button`, `Spinner`.
- Produces: `CoverPicker({ value: string; onChange: (url: string) => void; error?: string; onUploadingChange: (uploading: boolean) => void })`. `BookFieldsSection` gains prop `onCoverUploadingChange: (uploading: boolean) => void`.

- [ ] **Step 1: Create `CoverPicker`**

`apps/web/src/features/admin/components/CoverPicker.tsx`:

```tsx
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { COVER_CONTENT_TYPES, COVER_MAX_BYTES, COVER_MESSAGES } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ApiRequestError } from '@/lib/api/client';
import { useUploadCover } from '../api/useUploadCover';

interface CoverPickerProps {
  /** The form's `book.coverUrl`; `''` means the drawn cover. */
  value: string;
  onChange: (url: string) => void;
  /** Server `error.fields['book.coverUrl']` from the quest save. */
  error?: string;
  /** Must be stable (a state setter) — it runs in an effect. */
  onUploadingChange: (uploading: boolean) => void;
}

const HINT = 'JPEG, PNG or WebP · up to 5MB · leave empty for the drawn cover';

// Same rules the API enforces, checked first so a 12MB photo fails instantly instead of after the upload.
function checkFile(file: File): string | null {
  if (!(COVER_CONTENT_TYPES as readonly string[]).includes(file.type)) return COVER_MESSAGES.wrongType;
  if (file.size > COVER_MAX_BYTES) return COVER_MESSAGES.tooLarge;
  return null;
}

/** Uploads on pick; the quest save then sends the returned URL like any other field. */
export function CoverPicker({ value, onChange, error, onUploadingChange }: CoverPickerProps) {
  const inputId = useId();
  const msgId = `${inputId}-msg`;
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCover();
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => onUploadingChange(upload.isPending), [upload.isPending, onUploadingChange]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so picking the same file again still fires change
    if (!file) return;

    const problem = checkFile(file);
    setLocalError(problem);
    if (problem) return;

    setPreview(URL.createObjectURL(file));
    upload.mutate(file, {
      onSuccess: ({ url }) => onChange(url),
      onError: (err) =>
        setLocalError(err instanceof ApiRequestError ? (err.fields.file ?? err.message) : 'Upload failed. Try again.'),
      onSettled: () => setPreview(null)
    });
  }

  function handleRemove() {
    setLocalError(null);
    onChange('');
  }

  const shown = preview ?? (value || null);
  const message = localError ?? error ?? HINT;
  const isBad = Boolean(localError ?? error);

  return (
    <div className="grid gap-[0.4rem]">
      <span className="type-label">Cover</span>

      <div className="flex items-end gap-5">
        <label
          htmlFor={inputId}
          className="relative grid aspect-[2/3] w-32 cursor-pointer place-items-center overflow-hidden rounded-box border border-dashed border-[color:var(--rule-strong)] text-taupe transition-colors duration-150 hover:border-[color:var(--color-ember)] hover:text-paper-dim focus-within:border-[color:var(--color-ember)]"
        >
          {shown ? (
            <img
              src={shown}
              alt="Book cover"
              className={`h-full w-full object-cover transition-opacity ${upload.isPending ? 'opacity-50' : ''}`}
            />
          ) : (
            <span className="flex flex-col items-center gap-2 px-3 text-center text-sm">
              <ImagePlus aria-hidden className="h-6 w-6" />
              Choose a cover image
            </span>
          )}
          {upload.isPending && (
            <span className="absolute inset-0 grid place-items-center">
              <Spinner size="md" />
            </span>
          )}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={COVER_CONTENT_TYPES.join(',')}
            disabled={upload.isPending}
            aria-describedby={msgId}
            onChange={handleChange}
            className="sr-only"
          />
        </label>

        {value && !upload.isPending && (
          <div className="flex flex-col">
            <Button type="button" variant="quiet" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button type="button" variant="quiet" onClick={handleRemove}>
              Remove
            </Button>
          </div>
        )}
      </div>

      <p
        id={msgId}
        role="status"
        className={`m-0 min-h-[1.15rem] text-sm leading-[1.35] ${isBad ? 'text-[#E9976A]' : 'text-taupe'}`}
      >
        {message}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Swap it into `BookFieldsSection`**

In `apps/web/src/features/admin/components/BookFieldsSection.tsx`:

Add `import { CoverPicker } from './CoverPicker';`.

Add to `BookFieldsSectionProps`:

```ts
  /** Lets the editor hold Save while a cover is still uploading. */
  onCoverUploadingChange: (uploading: boolean) => void;
```

Replace the component's doc comment with:

```ts
/**
 * Title, author, pages, cover and description. The cover uploads on pick and
 * lands here as a URL, so the save path treats it like any other text field.
 */
```

Destructure `onCoverUploadingChange` in the signature, and replace the whole "Cover URL" `<Field … />` block with:

```tsx
      <CoverPicker
        value={value.coverUrl}
        error={errors['book.coverUrl']}
        onChange={(coverUrl) => set({ coverUrl })}
        onUploadingChange={onCoverUploadingChange}
      />
```

- [ ] **Step 3: Hold Save while uploading**

In `apps/web/src/features/admin/QuestEditorPage.tsx`, inside `QuestEditorForm`, after the `formError` state line add:

```ts
  const [isCoverUploading, setIsCoverUploading] = useState(false);
```

Change the `canSubmit` line to:

```ts
  const canSubmit =
    patch !== null && !dateIssues && resourcesAreValid && !update.isPending && !isCoverUploading;
```

And pass the setter to `BookFieldsSection`:

```tsx
        <BookFieldsSection
          value={form.book}
          errors={fieldErrors}
          onChange={(book) => setForm((prev) => ({ ...prev, book }))}
          onCoverUploadingChange={setIsCoverUploading}
        />
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck` (repo root; all packages)
Expected: exits 0.

- [ ] **Step 5: Verify in mock mode**

Run `VITE_MOCK_API=true pnpm --filter @bookquest/web dev`, sign in as the mock admin and open the admin quest editor.
- Empty state shows the dashed box and hint. Clicking it opens the native file picker. Tab to it, press Space, and the picker opens.
- Pick a PNG under 5MB: a dimmed preview with a spinner, then a crisp preview with Replace / Remove. Save → Home and `/book` show the photo cover.
- Pick a `.gif` or a >5MB file: the orange message appears instantly and no request shows in the console `[mock]` log.
- Remove → Save → the drawn cover returns.

- [ ] **Step 6: Verify against the real API**

Run API + web against the real API, signed in as an admin.
- Pick a JPEG. In DevTools → Network, the `POST /api/v1/admin/covers` request header reads `multipart/form-data; boundary=…`, and the response is 201.
- Save. The cover shows on Home, `/book` and the quest archive card, and the `GET /covers/…` response has `cross-origin-resource-policy: cross-origin`.
- Replace with another image and save. The first cover's URL now returns 404.
- Throttle the network to "Slow 3G" and pick a large (~4MB) image. **Save changes** stays disabled until the spinner ends.
- Stop the API mid-upload. The picker shows an error, the previous cover stays, and Save works again after restarting.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/admin/components/CoverPicker.tsx \
  apps/web/src/features/admin/components/BookFieldsSection.tsx \
  apps/web/src/features/admin/QuestEditorPage.tsx
git commit -m "feat(web): cover file picker in the quest editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Env example + spec sync

**Files:**
- Modify: `.env.example` (repo root)
- Modify: `docs/superpowers/specs/2026-09-29-cover-uploads-design.md`

- [ ] **Step 1: Document the new variable**

Add under the API section of `.env.example`:

```bash
# Public origin of the API as browsers reach it — uploaded cover URLs are built from it.
PUBLIC_API_URL=http://localhost:4000
```

- [ ] **Step 2: Sync the spec with the plan's refinements**

In the spec's "Files" list: replace the `validators/common.validators.ts` line with `utils/mongo.ts  + OBJECT_ID_PATTERN`. Add `utils/audit.ts` and `packages/shared/src/constants/cover.ts`. Change `metadata.uploadedBy` to "the uploading user's Mongo id".

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/superpowers/specs/2026-09-29-cover-uploads-design.md
git commit -m "docs: PUBLIC_API_URL in env example, spec matches implementation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
