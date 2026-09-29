# Cover uploads stored in MongoDB (GridFS) — design

Date: 2026-09-29
Status: approved in brainstorming, awaiting spec review

## Goal

Admins set a quest's book cover by **picking an image file** in the quest form, instead of pasting a URL (closes TBD-6). The file is stored in the existing MongoDB database and served by the API. Everything that already renders `book.coverUrl` keeps working unchanged.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Which images | Book covers only. Profile photos stay Telegram-hosted. |
| Storage | GridFS bucket `covers` in the existing MongoDB (not a `Buffer` on the quest document, not object storage) |
| What `coverUrl` stores | An absolute URL built from a new `PUBLIC_API_URL` env var |
| Size limit | 5 MB |
| Accepted types | JPEG, PNG, WebP |
| UI | A file picker replaces the "Cover URL" text field. No paste-a-URL fallback. |
| When the upload happens | Immediately on pick, not on form save |

Out of scope: image resizing/thumbnails, profile photo uploads, cleaning up covers uploaded to a form that was then abandoned.

## 1. API

### Config

`config/env.ts` gains:

```ts
/** Absolute base of this API as browsers reach it — uploaded cover URLs are built from it. */
PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
```

If it is left at the default in production, a line goes into `configWarnings`. It isn't fatal: nothing breaks until someone uploads.

### Storage

A lazily created `mongoose.mongo.GridFSBucket` named `covers` on `mongoose.connection.db`. Each file's metadata: `{ contentType, uploadedBy }` (the uploading user's Mongo id — every account has one; phone accounts have no Telegram id). `filename` is the original name, used only for debugging.

### Routes

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/v1/admin/covers` | admin (inherited from the `/admin` mount) | Upload one cover |
| `GET /api/v1/covers/:id` | public | Serve a cover |

**`POST /admin/covers`**: `multipart/form-data`, one file in field `file`.

1. `upload.middleware.ts`: `multer({ storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file')`. Multer's own errors become `ApiError`s:
   - `LIMIT_FILE_SIZE` → **413** `validation_failed`, `fields.file = "That file is over 5MB."`
   - any other multer error, or no file at all → **400** `validation_failed`, `fields.file = "Choose an image to upload."`
2. `cover.services.ts#uploadCover(buffer, originalName, uploadedBy)`:
   - Detects the real type from the first bytes with `utils/image-type.ts#detectImageType(buffer)`. It returns `'image/jpeg' | 'image/png' | 'image/webp' | null` by checking the JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, and WebP `RIFF????WEBP` signatures. The client-declared mimetype is ignored. `null` → **400** `validation_failed`, `fields.file = "Only JPEG, PNG or WebP images."`
   - Streams the buffer into the bucket and resolves with the new file's id.
   - Returns `{ url: \`${PUBLIC_API_URL}/api/v1/covers/${id}\` }`.
3. The controller logs the admin action (`action: 'upload-cover'`, `coverId`) the same way `admin/quest.controllers.ts#audit` does, then responds `201 { ok: true, data: { url } }`.

**`GET /covers/:id`**:

- `:id` is checked against `OBJECT_ID_PATTERN` inside `cover.services#openCover`. An invalid id → 404, the same as a missing one, so ids can't be probed by format.
- Looks up the file. Missing → **404** `not_found` ("No such cover.").
- Headers:
  - `Content-Type`: the stored `metadata.contentType`
  - `Content-Length`: the file length
  - `Cache-Control: public, max-age=31536000, immutable`. Covers are never modified in place: a new cover is a new id.
  - `Cross-Origin-Resource-Policy: cross-origin`. **Required.** Helmet's default `same-origin` makes browsers refuse to display the image on the web app's origin.
  - `X-Content-Type-Options: nosniff` (already set by helmet; stated here because it matters for served uploads).
- Streams `bucket.openDownloadStream(id)` into the response. A stream error after headers are sent destroys the response. Before that, it goes to the error middleware.

### Replacing or removing a cover

`quest.services#updateQuest`: when `payload.book` has a `coverUrl` key whose value differs from the stored one, and the **old** value is one of our cover URLs (`cover.services#coverIdFromUrl(url)` parses `${PUBLIC_API_URL}/api/v1/covers/<objectId>` and returns the id or `null`), call `cover.services#deleteCover(oldId)` **after** the quest update succeeds. Deletion is best effort: failures are logged with `logger.warn` and never fail the request.

### Files

```
apps/api/src/
  config/env.ts                         + PUBLIC_API_URL (+ production warning)
  middlewares/upload.middleware.ts      new — multer config + error translation
  utils/image-type.ts                   new — magic-byte detection
  services/cover.services.ts            new — bucket, uploadCover, streamCover lookup, deleteCover, coverIdFromUrl
  controllers/cover.controllers.ts      new — uploadCover, getCover
  routes/cover.routes.ts                new — GET /:id
  routes/admin/cover.routes.ts          new — POST /
  routes/index.ts                       + apiRoutes.use('/covers', coverRoutes)
  routes/admin/index.ts                 + adminRoutes.use('/covers', adminCoverRoutes)
  utils/mongo.ts                        + OBJECT_ID_PATTERN (shared by validators and the cover service)
  utils/audit.ts                        new — admin audit line, shared by quest and cover controllers
  validators/admin.validators.ts        uses OBJECT_ID_PATTERN
  services/quest.services.ts            delete replaced cover after update
```

Limits and copy (`COVER_MAX_BYTES`, `COVER_CONTENT_TYPES`, `COVER_MESSAGES`, `CoverUpload`) live in `packages/shared/src/constants/cover.ts`, so the browser pre-check and the API share one source.

New dependency: `multer` and `@types/multer` in `apps/api`.

The shared `coverUrl` schema (`z.string().url().nullable()`) is **unchanged**: an uploaded cover's URL is just a URL.

## 2. Web

### `CoverPicker` (`features/admin/components/CoverPicker.tsx`)

Props: `{ value: string; onChange: (url: string) => void; error?: string; onUploadingChange: (uploading: boolean) => void }`. `value` is the form's `book.coverUrl` string, and `''` means no cover.

States:

| State | Shows |
|---|---|
| Empty | Dashed 2:3 box, lucide `ImagePlus` icon, "Choose a cover image". Hint below: "JPEG, PNG or WebP · up to 5MB · leave empty for the drawn cover" |
| Uploading | The local preview (`URL.createObjectURL`), dimmed, with `Spinner` over it |
| Set | The cover in a 2:3 frame (`object-fit: cover`), with **Replace** and **Remove** buttons (existing `Button`) |
| Error | The message in the same slot and style `Field` uses for errors. The previous value stays |

- The trigger is a `<label>` wrapping a visually hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`. That gives the native picker and keyboard/screen-reader access for free. The input's value is reset after each pick so choosing the same file again still fires `change`.
- Before uploading, the browser checks type (in `accept` list) and size (≤ 5 MB) and shows the same messages the server would, without a network round trip.
- **Remove** calls `onChange('')`. The existing `questForm.ts` turns blank into `null` on save, so the drawn cover comes back.
- Object URLs are revoked when replaced and on unmount.
- Quests that already have a pasted URL render in the Set state. Replace/Remove work as normal.

`BookFieldsSection` swaps its "Cover URL" `Field` for `CoverPicker`, passing `errors['book.coverUrl']`. Its header comment about TBD-6 is updated.

### Upload hook (`features/admin/api/useUploadCover.ts`)

A `useMutation` that builds a `FormData` with `file` and calls `api.upload<{ url: string }>('/admin/covers', formData)`. On success, `CoverPicker` calls `onChange(url)`. On `ApiRequestError`, it shows `error.fields.file ?? error.message`.

### Save while uploading

`CoverPicker` reports uploading state up through `onUploadingChange`. The quest form disables its save button while an upload is in flight, so a quest can't be saved pointing at the previous cover by accident.

### API client (`lib/api/client.ts`)

- `send()`: when `body instanceof FormData`, pass it through as-is and **do not** set `Content-Type`. The browser must write the multipart boundary itself. JSON bodies behave exactly as today.
- `api.upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form })`.

### Mock mode

- `mock/transport.ts#readBody` returns the `FormData` for multipart requests.
- `mock/routes.ts` adds `{ method: 'POST', path: '/admin/covers', handle: uploadCover }`. It uses the same admin guard as other admin routes and returns `201 { url: URL.createObjectURL(file) }`. That link works for the browser session, which is all mock mode needs.

## 3. Error summary

| Case | Where caught | Result |
|---|---|---|
| Wrong type / over 5 MB | Browser first, server again | Inline message under the picker |
| File lies about its type | Server (magic bytes) | 400, "Only JPEG, PNG or WebP images." |
| Not an admin | `/admin` mount | 401/403 (existing) |
| Network / 500 during upload | `useUploadCover` | Inline message; previous cover kept |
| Old cover delete fails | `quest.services` | Logged; quest save still succeeds |
| Unknown / malformed cover id | `GET /covers/:id` | 404 |

## 4. Verification

- API: `curl -F file=@cover.jpg` with an admin token → 201 + URL. Opening the URL shows the image with the expected headers. A renamed `.txt` → 400. A 6 MB file → 413. No token → 401.
- Web (real API): pick → preview → save → the cover shows on Home and Book pages. Replace → the old GridFS file is gone. Remove → drawn cover. Save is disabled mid-upload.
- Web (mock mode): pick → preview → save works without the API.
- `pnpm typecheck` passes.
