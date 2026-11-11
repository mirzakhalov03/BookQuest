# Certificates — Design

**Goal:** everyone who finishes the quiz gets a well-designed certificate with their name on it. The
top three get a distinct version that shows their place (1st, 2nd, 3rd). People receive it in the bot
chat, keep it on `/me`, can download and share it, and anyone can check that it's genuine.

**Why now:** the data side is mostly there (`CertificateData`, `GET /participants/me/certificate`,
verification codes on results), but what exists today can't ship:
- **Every certificate shows a rank.** `rankQuest` gives every result a rank (`index + 1`), so
  `rank` is never null once results are ranked. The 47th-place finisher would get "Certificate of
  achievement — finished 47th". Only the podium should carry a place.
- **It can't be saved where most people open it.** Saving is `window.print()`. Telegram's in-app
  webviews on iOS and Android generally don't support printing, and that's where most participants are.
- **It's a responsive page section, not a document.** It reflows with the screen instead of having
  fixed, printable proportions.

**Anti-goals (would make this a failure even if it works):**
- A completion certificate reads as a consolation prize. Both kinds must feel like an award.
- A certificate shows a different name, place or book from the leaderboard. There's one source of
  truth: participant + quest + result.
- Anyone can enumerate other people's certificates, or a certificate exposes contact details.
- A failed or restarted send leaves people without a certificate, or sends someone two.

**Out of scope (v1):** a PDF download (the PNG prints fine; see *Later*), Telegram Story sharing, a list
of past editions' certificates on `/me`, admin re-issue after a name change, printed/posted copies.

---

## 0. Dependency: the quiz

Results are written by the quiz (Phase 6), which isn't built (`result.model.ts`: "Written by the
quiz (not yet built)"). Everything here reads `Result` documents and can be built and tested
before the quiz exists, using seeded results (§9). Nothing in this spec decides how the quiz scores
or times people.

---

## 1. Who gets what

| Finisher | Tier | Place shown |
|---|---|---|
| Rank 1 | `gold` | 1st |
| Rank 2 | `silver` | 2nd |
| Rank 3 | `bronze` | 3rd |
| Everyone else who submitted a result | `participant` | none |

- "Finished" means a `Result` exists for the participant on that quest. A score of 0 still finishes.
- Ranks are a total order (score ↓, duration ↑, submittedAt ↑, `_id` ↑), so ties can't put two people
  in one podium slot.
- Registered but never submitted: no certificate.

**When:** certificates are issued when results are published (`now >= quest.resultsAt`). Ranks aren't
final before then, so a certificate issued at submit time couldn't know its tier. See open question
Q1 for the alternative (completion at submit, podium upgrade at results).

---

## 2. Data contract

`certificateDataSchema` in `packages/shared/src/schemas/result.ts` changes:

```ts
export const CERTIFICATE_TIERS = ['gold', 'silver', 'bronze', 'participant'] as const;

export const certificateDataSchema = z.object({
  code: z.string(),                      // "BQ4-K7M2QX", unchanged
  fullName: z.string(),
  participantNumber: z.number().int(),
  questEdition: z.number().int(),
  questYear: z.number().int(),
  bookTitle: z.string(),
  bookAuthor: z.string(),
  /** 1, 2 or 3 for the podium; null for everyone else. Replaces `rank`. */
  placing: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  tier: z.enum(CERTIFICATE_TIERS),
  /** How many finished, for copy like "among 412 readers". The design may not use it. */
  finishedCount: z.number().int().nonnegative(),
  issuedAt: z.string(),
  /** Absolute URLs, so the web app, the bot and the verify page all use the same ones. */
  imageUrl: z.string().url(),
  verifyUrl: z.string().url()
});
```

- **`rank` is removed, not kept beside `placing`.** The certificate never needs the full rank, and
  keeping it invites the bug above to come back. Full ranks stay on the leaderboard.
- `tier` is derived from `placing`. It's sent anyway so the client and the template never re-derive it.
- `placing`/`tier` are computed in one shared helper, `certificateTier(rank)`, used by the API and the
  web mock.
- Still **no `certificates` collection** (BACKEND-SPEC §"No certificates collection"). The only new
  persisted state is delivery bookkeeping on `Result` (§5).

`FRONTEND-SPEC.md` and `BACKEND-SPEC.md` get the same `CertificateData` update.

---

## 3. Rendering: server-side PNG with satori

**Decision:** the API renders each certificate to a PNG with **`satori`** (JSX → SVG) and
**`@resvg/resvg-js`** (SVG → PNG). This resolves TBD-3.

**Why:**
- The bot has to send a file, and Telegram webviews can't print. Both need a real image that exists
  outside the browser.
- TBD-3 rejected server rendering because it meant a headless browser. Satori doesn't need one: it's a
  pure-JS layout engine plus a native resvg binary. Rendering takes tens to hundreds of milliseconds,
  with no Chromium.
- The template is written in JSX, so it's familiar React for whoever builds the design.

**Shape:**
- `apps/api/src/certificates/template.tsx`: `CertificateTemplate({ data, qrSvg })`, one component that
  switches on `data.tier`. The API tsconfig gets `"jsx": "react-jsx"`, and `react` is added as a
  dependency for the JSX runtime only. Satori doesn't run React, it reads the element tree.
- `apps/api/src/certificates/render.ts`: `renderCertificatePng(data): Promise<Buffer>`. It loads
  fonts once at startup, builds the QR (`qrcode` → SVG string → data URI `<img>`), runs satori, then
  resvg.
- `apps/api/assets/fonts/`: the font files the design needs, checked in. Satori needs TTF/OTF/WOFF
  (**not WOFF2**).
- **Canvas:** A4 landscape, 1123 × 794 layout px, rasterised at 2× → **2246 × 1588 PNG**. That's
  ≈190 dpi on A4, enough to print and small enough to send (expect roughly 300–600 KB).
- `TEMPLATE_VERSION` constant: bumped whenever the template changes, so caches don't serve old art.

**Caching:** an in-process LRU (about 200 entries), keyed by `code + TEMPLATE_VERSION + hash(data)`.
Including the data hash means a corrected name re-renders without manual invalidation. Same
single-instance assumption as the leaderboard cache and the rate limiter. A disk or object-store cache
is unnecessary at about 1,000 certificates a year.

**Satori constraints the design must respect** (a checklist for §8):
- Flexbox only. No CSS grid, no `position: fixed`, no `z-index` stacking tricks; absolute positioning
  works.
- Inline styles only. No stylesheets, no `:hover`, no media queries, no CSS variables.
- Only the fonts that are loaded. The display font must cover **Cyrillic** if any participant names are
  Cyrillic. Archivo's Google Fonts build may not; check it, or add a fallback such as Noto Sans.
  Latin Uzbek names with apostrophes (O'g'li) are already normalised by `parseFullName`.
- Images as data URIs or absolute URLs. Inline SVG works. Gradients and border-radius work.
- Long names: names are capped at two words by `parseFullName`, but "Muhammadabdulaziz
  Abdurakhmonova" exists. The template shrinks the name font by character count (a simple step
  function in `render.ts`), because satori can't auto-fit text.

---

## 4. API

### Participant

**`GET /api/v1/participants/me/certificate`** (existing, session required)
- Returns the new `CertificateData`. Still `404 not_found` until results are published and the
  participant has a result. The web app already treats that as "not yet".

### Public, by code

Codes are `BQ{edition}-` followed by 6 characters from a 31-character alphabet (≈887 million
combinations per edition), so they can't practically be guessed. Holding a code is the permission. The
participant chooses to share it by sharing the certificate.

**`GET /api/v1/certificates/:code`** → public verification
```json
{ "ok": true, "data": {
  "code": "BQ4-K7M2QX", "fullName": "Sofia Karimova", "participantNumber": 42,
  "questEdition": 4, "questYear": 2026, "bookTitle": "The Alchemist", "bookAuthor": "Paulo Coelho",
  "placing": 1, "tier": "gold", "issuedAt": "2026-12-14T15:00:00.000Z", "imageUrl": "…"
} }
```
- Unknown code → `404 not_found`, with the same response time as a hit, so a miss reveals nothing.
- **Works for any edition, not only the current quest**, because a certificate from 2025 must still
  verify in 2027. This is a lookup by `certificateCode` (already uniquely indexed), not via
  `requireCurrentQuestDocument`.
- Never returns contact details, score, duration or full rank.

**`GET /api/v1/certificates/:code/image.png`** → the PNG
- `Content-Type: image/png`, `Cache-Control: public, max-age=86400`, and an `ETag` from the cache key.
- `Content-Disposition: inline; filename="BookQuest-2026-Sofia-Karimova.png"`. Add `?download=1` to
  switch to `attachment`, for browsers where `<a download>` is ignored across origins.
- Public on purpose: link previews, the verify page and Telegram's `downloadFile` all need a plain
  URL.

**Rate limit:** a new `certificateRateLimit`, 30 requests/min per IP across both public routes, on top
of the global limiter. That's generous for people opening their own certificate and makes enumeration
pointless.

**Code normalisation:** accept lowercase and missing dashes (`bq4k7m2qx`), then normalise before
lookup. People will type codes from paper.

### Admin

**`POST /api/v1/admin/certificates/send`** → starts delivery for the current quest (§5)
- `409 conflict` if results aren't published yet, or a delivery is already running.
- Returns the delivery status immediately and keeps sending after the response, like `sendBroadcast`.

**`GET /api/v1/admin/certificates/delivery`** → `{ status, total, sent, failed, noTelegram, startedAt, completedAt }`
- Polled by the admin page while `status === 'sending'`.

**`GET /api/v1/admin/certificates/preview?tier=gold`** → a PNG rendered from sample data for that tier
- Lets organisers check the art before sending without needing a real result. Admin-only, not cached.

Files: `routes/certificate.routes.ts`, `routes/admin/certificate.routes.ts`,
`controllers/certificate.controllers.ts`, `services/certificate.services.ts`
(`getCertificateByCode`, `getCertificateImage`, `startCertificateDelivery`, `getDeliveryStatus`).
`getCertificateForUser` moves out of `result.services.ts` into `certificate.services.ts`. Ranking
(`ensureRanked`) stays in result services and is imported.

---

## 5. Delivery: the bot sends everyone their certificate

**Trigger: an organiser presses "Send certificates"** on the admin Results page. It isn't automatic
when `resultsAt` passes.
- Results publish lazily (the first read after `resultsAt` ranks the quest). There's no scheduler and no
  event to hang a send on, and adding a scheduler for one event a year isn't worth it.
- Organisers get a moment to look at the final leaderboard and preview the art before about 1,000
  people receive something permanent.
- The admin Results page shows a reminder once results are live and certificates haven't been sent.

**Bookkeeping, on `Result` (no new collection):**
```ts
certificateSentAt: { type: Date, default: null },
certificateSendError: { type: String, enum: ['blocked', 'failed', 'no_telegram', null], default: null },
```
Plus one small `CertificateDelivery` document per quest (`status`, `startedAt`, `completedAt`,
`startedBy`) so the admin page has something to poll. Counts are aggregated from `Result`.

**Loop**, built on the broadcast machinery (move `createRateGate` out of `broadcast.services.ts` into
`utils/rate-gate.ts` and share it):
1. `ensureRanked(quest)`.
2. Select results where `certificateSentAt: null`, then join participant → user for `telegramUserId`
   and `dmBlockedAt`.
3. For each, using the same concurrency (10) and rate limit (25/s) as broadcasts:
   - Insert an in-app `Notification` (`kind: 'system'`, "Your BookQuest certificate is ready")
     **for everyone**, including people without Telegram. It's idempotent per `(user, quest)` through a
     unique key in the notification body metadata, or a guard check before inserting.
   - If the person is reachable by DM: render the PNG and send it with `sendTelegramPhoto`
     (multipart), with a caption and an inline `web_app` button "Open in BookQuest" → `/me`.
   - Set `certificateSentAt`, or `certificateSendError`. A Telegram 403 also sets `dmBlockedAt` on
     the user, as broadcasts do.
4. Mark the delivery `sent`, or `interrupted` on a crash.

**Idempotent and resumable:** the loop only picks up `certificateSentAt: null`. Pressing the button
again after a restart or an interruption continues where it stopped, and nobody gets a second message.
On boot, a delivery left in `sending` is marked `interrupted`, the same rule broadcasts use.

**Photo, not document:** `sendPhoto` shows the certificate inline in the chat, which is the moment
people screenshot and share. Telegram compresses photos to about 1280 px wide, so the caption points to
`/me` for the full-resolution download. If organisers want the original file in chat, add a
`sendDocument` follow-up later; it's one more call per person.

**Captions** (copy to finalise with the design):
- Podium: "🥇 Sofia, you finished 1st in BookQuest 2026! Here's your certificate."
- Everyone else: "Sofia, you finished BookQuest 2026. Here's your certificate. Thank you for reading
  with us!"

New util: `utils/telegram-send.ts` gains `sendTelegramPhoto(telegramUserId, png, caption, button)`,
returning the same `SendOutcome` and never throwing. It uses Node 22's built-in `FormData` + `Blob`,
with no new dependency.

---

## 6. Web

### `/me` — `CertificateSection`
- Shows the PNG (`<img src={data.imageUrl}>`, intrinsic aspect ratio 1123:794, full width,
  `loading="lazy"`, alt text "Certificate for {name}, BookQuest {year}").
- **Download** button:
  - In Telegram: `WebApp.downloadFile({ url: imageUrl + '?download=1', file_name })` (Bot API 8.0+),
    feature-detected in `lib/telegram.ts` with the existing try/catch guard. Older clients fall back to
    `openLink(imageUrl)`, so the system viewer can save it.
  - In the browser: `<a href={imageUrl + '?download=1'} download>`.
- **Share** button: `navigator.share({ files: [png] })` where it's supported (mobile browsers),
  otherwise copy `verifyUrl`. Hidden in Telegram, where neither is reliable; Telegram users share from
  the chat.
- `Certificate.tsx`'s HTML rendering and the `.certificate*` / `@media print` CSS in `results.css` are
  **deleted**. The PNG is the certificate, and there's one design in one place (the satori template).
- The empty state ("Your certificate lands here") is unchanged.

### `/verify/:code` — new public route
- Uses `GET /certificates/:code`. Shows a clear "✓ Genuine BookQuest certificate" header, the
  certificate image, and the facts in text (name, edition, year, book, place if any, issue date).
- Unknown code: "We couldn't find a certificate with this code. Check it and try again", with an input
  to retype the code.
- `/verify` with no code shows just that input.
- Public, no session, no tab bar highlighting. Works outside Telegram, since it's what the QR code on
  the paper opens.
- Open Graph tags aren't possible from a client-rendered SPA. Accepted for v1 (see *Later*).

### Mock API
`lib/api/mock/routes.ts` gets the new endpoints. The mock image is a static placeholder PNG per tier
in `src/assets/certificates/`, since the mock can't run satori.

### Admin Results page
- A "Certificates" panel: tier previews (from `/admin/certificates/preview`), a **Send certificates**
  button with a confirm sheet ("Send to 412 finishers? 388 by Telegram, 24 in-app only"), then a live
  progress bar from `/admin/certificates/delivery`. It has the same look and polling as the Broadcast
  page.

---

## 7. QR code and URLs

- `verifyUrl = ${WEB_APP_URL}/verify/${code}`. `imageUrl = ${API_PUBLIC_URL}/api/v1/certificates/${code}/image.png`.
- `WEB_APP_URL` becomes **required** when certificates are enabled. Today it's optional, and the QR
  code and links are meaningless without it. The API refuses to start delivery if it's unset, with
  a clear error.
- A new optional `API_PUBLIC_URL` env var, falling back to `WEB_APP_URL` when the web app proxies
  `/api`.
- The QR code encodes `verifyUrl` with error correction level M, drawn dark-on-light whatever the
  design's background, with a quiet zone of at least 4 modules so phone cameras read it.

---

## 8. Visual design — OPEN

**Not decided yet.** The organiser will provide the design. Everything above works with any design
that fits these inputs and constraints. Implementation can go ahead with a plain placeholder
template, and the real art then replaces `template.tsx` without touching anything else.

**Fixed requirements the design must meet:**
- Four tiers from one template: `gold`, `silver`, `bronze`, `participant`. Podium tiers show the place
  (1st/2nd/3rd). The participant tier shows no rank, and must not read as the lesser award.
- Every tier shows: full name (the focal point), book title and author, edition and year, issue date,
  participant number, verification code, and a QR code (dark on light, at least about 18 mm printed).
- Optional, if the design wants them: `finishedCount` ("among 412 readers"), a prize line (Q2), an
  organiser signature (Q3).
- A4 landscape, 1123 × 794 layout px. Satori constraints from §3 apply: flexbox, inline styles,
  bundled TTF/OTF/WOFF fonts with Cyrillic coverage, no CSS grid.
- The longest realistic two-word name must fit (§3, long names).

**Exploration so far (reference only, not approved):** two mockup rounds, one dark (ink background,
brand gold, metal medals) and one bright (warm white background, ember orange frame and title pill,
metal medals, orange "Reader" badge for participants). The organiser asked for bright colours (white,
the brand orange, gold), so the final design will likely be closer to the second round.

**When the design arrives:** convert it to `template.tsx`, check all four tiers with
`/admin/certificates/preview`, test the longest-name and Cyrillic samples, then bump
`TEMPLATE_VERSION`.

---

## 9. Testing and verification

The API has no test runner yet, so verification is scripted and manual, as in the earlier specs.

- **Seed script** `pnpm --filter @bookquest/api seed:results`: creates N fake participants with
  results on the current quest (including a 0-score finisher, a Cyrillic name and a maximum-length
  name) and moves `resultsAt` into the past. Dev only; refuses to run when `NODE_ENV=production`.
- Ranks 1–3 get `placing` 1/2/3 and the matching tier; rank 4 and below get `placing: null`,
  `tier: 'participant'`.
- `GET /certificates/:code` works for a code from a **previous** edition after a new edition is created.
- Lowercase or dash-less codes resolve. Unknown codes return 404. The 31st request in a minute returns
  429.
- Image ETag/304 works, and changing a participant's name changes the rendered image.
- Delivery: run against a test bot with three Telegram accounts (one blocked, one not linked, one
  normal). Expect one photo, one `blocked` with `dmBlockedAt` set, one `no_telegram`, and three in-app
  notifications.
- Kill the API mid-delivery: the status becomes `interrupted` on boot, and pressing Send again finishes
  the rest without duplicates.
- Telegram: Download on iOS and Android (with `downloadFile` and the `openLink` fallback), the inline
  web_app button opens `/me`, and the QR code scanned from a printed page opens `/verify/:code`.
- Render time and memory for 1,000 certificates in a delivery run: aim for under 300 ms each and no
  heap growth beyond the LRU.

---

## 10. Build order

1. Shared: `CertificateData` change, `certificateTier`. Update both specs' contract sections.
2. API: satori render pipeline with a **placeholder** template, fonts, QR, the preview endpoint.
3. API: public by-code endpoints, rate limit, code normalisation; move `getCertificateForUser`.
4. API: delivery (rate-gate extraction, `sendTelegramPhoto`, `Result` fields, `CertificateDelivery`,
   boot recovery).
5. Web: `/me` image + download/share, delete the HTML certificate and print CSS, mock routes.
6. Web: `/verify/:code`.
7. Web: admin Certificates panel.
8. Seed script and §9 verification.
9. **When the design arrives:** the real `template.tsx` (§8).

Steps 1–8 don't depend on the design.

---

## Implementation notes (2026-11-11)

Built per `docs/superpowers/plans/2026-11-11-certificates.md`. Where the build differs from the sections
above, this list wins:

- **`PUBLIC_API_URL`, not a new `API_PUBLIC_URL`.** It already existed for cover URLs, and `imageUrl` uses it.
- **`WEB_APP_URL` is enforced when sending, not at boot** (§7). Requiring it at boot would break local dev.
  Sending returns `409` without it, production logs a warning, and dev falls back to `http://localhost:5173`.
- **The verify route returns the same `CertificateData`** as `/me`. Nothing in it is private. The
  "same response time on a miss" idea (§4) was dropped: the status code already says whether a code exists.
- **Previews are public sample images** at `GET /certificates/preview/:sample.png`, not an admin route
  (§4, §6). An `<img>` can't send the admin token. The samples have fixed names and a `SAMPLE` stamp, so
  they can't be used to forge a certificate.
- **A failed DM is retried by pressing Send again** (§5). `failed` leaves the row pending; `blocked` and
  `no_telegram` don't, since retrying them is pointless.
- **Notification idempotency** uses `Result.certificateNotifiedAt`, claimed before the insert. A crash in
  that gap loses one notification instead of doubling it; the person still has the certificate on `/me`.
  A crash right after a successful Telegram send re-sends that photo on resume, which affects at most the
  rows in flight. Both were reproduced by killing the server mid-send: 1 of 240 notifications lost,
  2 photos duplicated, none missed.
- **Download filenames use the code** (`BookQuest-2026-BQ4-K7M2QX.png`), not the name, because pino-http
  logs response headers and names never go in logs.
- **`Cross-Origin-Resource-Policy: cross-origin`** on the PNG routes. Helmet's `same-origin` default would
  stop the web app, on another origin, from showing them (covers already did the same).
- **Rendering is off the event loop and one at a time.** The sync resvg render blocked the event loop
  ~350 ms per certificate: during a 200-certificate send, `/health` reached 790 ms. `renderAsync` moves
  rasterising to the libuv pool, and a cap of one concurrent render stops satori and the PNG encode
  (~60 ms) stacking up. `/health` then averages 21 ms during a send (max 142 ms), at about 5
  certificates/s, so 1,000 finishers take roughly 3.5 minutes.
- **Satori defaults to `box-sizing: content-box`.** The template sets `border-box` on its root, or padding
  and border push the footer off the canvas. Whoever converts the real design (§8) needs to know this.
- **Fonts:** Archivo (`latin`, `latin-ext`) and Noto Sans (`cyrillic`) from `@fontsource`, as `.woff`.
  Cyrillic names render correctly through the fallback.
- **The QR code was checked by decoding the rendered PNG** (jsQR); it resolves to `verifyUrl`.
- **Seeded finishers use numbers from 3700,** because participant numbers are capped at 3999. They stay
  clear of real registrations, which count up from 3000.

## Open questions

| # | Question | Default if unanswered |
|---|---|---|
| Q1 | Issue at results publication only, or a completion certificate right after submitting, with the podium version replacing it at results? | At results only (§1). The other option means rendering twice and the top 3 holding two different certificates for a while. |
| Q2 | Do podium certificates mention the prize (`quest.prizes.first` etc.)? | No. Prizes are free text and may be cash amounts, which read oddly on a certificate. |
| Q3 | Who signs it: a named organiser with a signature image, or "BookQuest Team"? | "BookQuest Team", no signature image. |
| Q4 | Should the verify page show the participant number? | Yes. It's already printed on the certificate. |
| Q5 | Does the display font cover Cyrillic, and are Cyrillic names expected? | Assume yes and bundle a Cyrillic-capable fallback. |

## Later

- PDF download (`pdf-lib` wrapping the PNG, A4 page) for people who want a "real" document.
- 9:16 Story variant and `WebApp.shareToStory`.
- `/me` lists certificates from past editions (the by-code endpoints already support it).
- Admin re-issue for a single person after a name correction (re-send the photo).
- Server-rendered Open Graph tags for `/verify/:code`, so shared links preview the certificate.
