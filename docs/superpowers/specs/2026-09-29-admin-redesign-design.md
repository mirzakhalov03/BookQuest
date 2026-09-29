# Admin Redesign — Design

**Date:** 2026-09-29
**Status:** Approved direction (from the admin UX audit); ready for planning.
**Scope:** everything under `/admin` in `apps/web`, plus the API changes those screens need.

## Why

The admin section is solid underneath: it sends a minimal patch, runs the same date check on client and server, and handles `403` properly. The flow on top of that has real friction:

- **Dead end between editions.** The Dashboard says "Start the next one from the quest editor". The editor then says "There's nothing to edit". The API can create a quest and make it current, but no screen calls it.
- **The broadcast request can outlive its HTTP connection.** Every DM is sent inside a single request, 35ms apart. With 1,000+ users that takes minutes. A proxy timeout shows an error while messages are still going out, and a second tap sends everyone the message twice.
- **The quest editor on a phone:** about 17 inputs with Save five screens down, no warning before unsaved edits are lost, and five separate date fields that have to be edited one by one to move a schedule.
- **Shell bugs:** the header pads its top with the *bottom* safe-area inset. The Telegram back button appears on tab roots. The Dashboard prints the raw phase slug.
- **Duplication:** every page repeats the same loading, forbidden, not-found and error branches. Textarea, select and search inputs are styled by hand in five places, and the error colour is a hex literal in seven files.

## Principles

1. **Mobile first.** Every screen is designed at 390px first, then adapted at `sm` (640), `lg` (1024) and the existing `900px` tab-bar breakpoint.
2. **One way to do each thing.** One sheet primitive, one query-state wrapper, one page header, one form model shared by edit and create.
3. **Ask for confirmation only when it matters.** Typo fixes save directly. Changing dates or prizes on a live quest, starting an edition and broadcasting each get one confirmation step.
4. **The server stays the authority.** Client validation mirrors it for instant feedback but never replaces it. Server `error.fields` always land on the matching input.
5. **No new infrastructure.** No queue, no WebSockets, no new services. The API is a long-running Express process (`server.ts` calls `listen`), so background work after a response is safe.

## 1. Shared foundations (web)

| Piece | What | Where |
|---|---|---|
| Error colour tokens | `--color-error: #e9976a` (message text) and `--color-error-line: #b2532a` (input underline), used as `text-error` / `border-b-error-line`. They replace every hex literal. | `styles/theme.css` |
| Top safe area | `--safe-t`: the larger of the OS inset and Telegram's fullscreen insets (`--tg-safe-area-inset-top` + `--tg-content-safe-area-inset-top`). | `styles/base.css` |
| `TextArea`, `Select`, `SearchInput` | Match `Field`'s ruled style: label, underline, message slot. `TextArea` accepts a `head` slot, used for character counters. | `components/ui/` |
| `Sheet` | Modal built on native `<dialog>` (focus trap, Esc and backdrop for free). Bottom sheet below 640px, centred dialog above. Props: `open`, `onClose`, `title`, `children`, `actions`. | `components/ui/Sheet.tsx` |
| `useMediaQuery` | `useSyncExternalStore` over `matchMedia`. | `hooks/useMediaQuery.ts` |
| `formatShortDate` | "5 Apr" (en-GB, day plus short month). | `lib/format.ts` |
| `AdminPageHeader` | Eyebrow, title, optional `actions` slot. | `features/admin/components/` |
| `AdminQuery` | Takes a `UseQueryResult<T>` and renders loading, `403` → `ForbiddenState`, `404` → caller's `notFound`, other errors → `ErrorState` with retry, and success → `children(data)`. | `features/admin/components/` |
| Phase vocabulary | `PHASE_LABEL` ("Upcoming", "Reading", "Quiz open", "Finished") and `nextMilestone(quest)` → `{ label, at } \| null`. | `features/admin/phase.ts` |

`AdminStats.phase` is retyped from `string` to `QuestPhase` in `@bookquest/shared`.

## 2. Shell

- The header's top padding uses `--safe-t`.
- **Back-button rule:** tab roots (`/admin`, `participants`, `quest`, `results`, `broadcast`) never show the Telegram back button. Real sub-pages do; the only one is `/admin/quest/new` → `/admin/quest`.
- Every page uses `AdminPageHeader` and `AdminQuery`.

## 3. Quest editor (`/admin/quest`)

### Form model

- **react-hook-form** (`^7`) with **zodResolver** over a web-side `questFormSchema`. Form values stay as strings (the current `QuestFormState` shape).
  - The schema mirrors the API's limits and calls `findQuestDateIssues` in a `superRefine`. That one schema replaces the ad-hoc `dateIssues` / `resourcesAreValid` checks.
  - Dependencies: `react-hook-form`, `@hookform/resolvers`, `zod` (`^4`, same major as shared).
- `buildQuestPatch(quest, values)` stays as the single diff. `summarizeChanges(patch)` → `{ count, sections }` drives:
  - the "3 changes" count,
  - the per-section unsaved dots,
  - the review sheet.

  The count reflects what will actually be sent, so a whitespace-only edit doesn't count.
- **Server errors:** `error.fields` map onto form paths (`opensAt` → `dates.opensAt`, everything else keeps its name) through `setError`. Keys with no field go to a form-level message.
- **After a save:** `reset(toFormState(updated))` makes the server's answer the new baseline.
- **Cover upload:** `CoverPicker` writes through `setValue('book.coverUrl', url, { shouldDirty: true })`. This keeps the guarantee from the last commit: an upload that finishes late can't overwrite other edits.

### Layout

- **Five collapsible sections** (`EditorSection`): Book, Resources, Prizes, Dates, Quiz. Each header shows a one-line summary built from the current values, a dot for unsaved changes and a warning mark for errors.
  - A section with an error is always open.
  - All sections start open at ≥1024px and closed below it.
- **Desktop (≥1024px):** two columns. The form sits on the left (`max-w-2xl`) and a sticky preview on the right.
- **Mobile:** a "Preview" action in the page header opens the preview in a `Sheet`.

### Save bar

Pinned above the tab bar, and shown only when the form is dirty: `3 changes · Discard · Save`.
- When there are errors, the count line reads "Fix 2 fields" instead.
- Save stays disabled while saving or while a cover is uploading.
- ⌘S / Ctrl+S submits.
- The page adds bottom padding while the bar is visible so the last section is never covered.

### Unsaved-changes guard

- React Router `useBlocker` (the app uses `createBrowserRouter`, a data router). While the form is dirty, leaving the page opens a "Discard changes?" `Sheet`.
- `beforeunload` covers the web. Telegram's closing confirmation is already on globally (`initTelegram`).
- The guard has a `bypass()` that is called right before navigating after a successful create.

### Dates timeline

A vertical rail of the five dates:
- The time between consecutive dates is shown ("Reading · 42 days").
- A "Now" marker sits at the current moment.
- Each node shows its state: passed, next or future.
- **Keep the gaps** (a `Switch`, on by default): changing one date shifts every later date by the same amount.
- **Past dates are locked** in edit mode on a live quest. An "Edit anyway" button unlocks that single field.
- Read-only mode (the Dashboard) renders the same rail with formatted dates instead of inputs, via a shared `QuestTimeline`.

### Resources

- `useFieldArray` gives rows stable keys; today they are keyed by index.
- **Paste a URL first.** `inferKind(url)` picks pdf, epub, audio or link from the file extension or a known audio host. `defaultLabel(kind, url)` fills the label ("PDF", "EPUB", "Audiobook", or the hostname).
- Rows are collapsed by default (icon · label · hostname). Tapping one expands label, URL and kind plus Remove and Move up/down.
- The maximum is still 12.

### Review sheet

- **When it opens:** a save where the quest is not `upcoming` and the patch touches any date or prize.
- **What it lists:** each change as `label: before → after`, then "*N* participants will see this". Actions: Save / Keep editing.
- Any other save goes through without it.

### Preview

- `QuestPreview` renders `BookHero` (it gains a `titleAs` prop so it can render as `h2` inside the admin page), plus the description, resources and prizes, all from unsaved values.
- `BookHero` is the participant-facing component, so the preview can't drift from what participants see.

## 4. Start next edition (`/admin/quest/new`)

### API

`POST /admin/quests` accepts `makeCurrent: boolean` (default `false`). When `true`, creating the quest and switching the current flag happen in **one transaction**. A half-finished state (created but not current) can't happen, and the client makes a single request.

### Source quest

`useLatestQuest()` looks, in order, at:
1. the current quest,
2. the newest archived quest (`GET /quests?limit=1`, then `GET /quests/:edition`),
3. `null` for the very first edition.

### Guard

The page is only for starting an edition once the current one's results are out. If the current quest's phase is anything but `finished`, the page shows an empty state: "Edition IV is still running…".

### Draft

`nextEditionDraft(source, now)`:
- edition + 1,
- an empty book,
- prizes and quiz settings copied,
- every date moved forward one calendar year.

With no source: edition 1 and `defaultDates(now)` (opens in 7 days at 09:00, 60 days of reading, a 2-day quiz, results a day later).

### Form and submit

- The same section components as the editor (`QuestFormFields`, which uses `useFormContext`), with create-mode summaries. The year is derived from `opensAt`.
- The Create button opens a confirmation `Sheet`: "Make Edition V current? Edition IV and its results move to the archive."
- On success:
  1. seed `questKeys.current()` with the new quest,
  2. invalidate `questKeys.all`, `questArchiveKeys.all` and `adminKeys.all`,
  3. call `bypass()` on the guard,
  4. navigate to `/admin/quest`,
  5. show the toast "Edition V is live.".
- A `409` (edition already exists) shows as a form-level message.

### Entry points

- The Dashboard (phase `finished`, or no current quest).
- The quest editor's `404` state.
- A secondary link in the editor header when the phase is `finished`.

## 5. Broadcast

### API

- **Model:** `Broadcast` gains:
  - `status` (`sending` \| `sent` \| `interrupted`),
  - `dmCount` (Telegram-linked recipients),
  - `sentCount`, `failedCount`,
  - `completedAt`.
- **`POST /admin/broadcasts`:** writes the record and every `Notification` row, answers **`202`** with `status: 'sending'`, then delivers DMs in the background.
  - It `$inc`s progress every 25 sends and marks the broadcast `sent` at the end.
  - A crash in the loop marks it `interrupted`. The request itself never waits for delivery.
- **`GET /admin/broadcasts`** → `{ items: Broadcast[] (latest 20), audience: number }`. `audience` is the total user count, which is who a broadcast reaches in-app.
- **Boot:** any `sending` rows left behind by a restart become `interrupted`.
- `BROADCAST_MAX_LENGTH = 1000` moves into shared constants and is used by both the schema and the counter.

### Web

- **Composer**
  - `TextArea` with a `n / 1000` counter that turns to the error colour past 90%. Typing is capped at the limit instead of cut off silently.
  - Suggestion chips built from the quest's phase and dates.
  - A preview styled as a Telegram message bubble.
- **Audience line:** "Reaches 1,284 people · 1,020 on Telegram".
- **Send:** opens a confirmation `Sheet` that repeats the audience count and the message. The button is disabled while the send request is in flight.
- **History:** the latest 20, each with a status. "Sending" shows a `sent / dmCount` progress line. The list polls every 2s while any row is `sending`, and stops otherwise.
- **Draft handoff:** a draft can arrive through router state (`navigate('/admin/broadcast', { state: { draft } })`) from the Dashboard's next-step actions.
- **Mock API:** gains `GET` and `POST /admin/broadcasts`, which today don't exist in the mock.

## 6. Dashboard

- **Header:** edition and book title, plus a phase chip from `PHASE_LABEL`.
- **Next milestone:** "Quiz opens in 12 days · 5 April 2027, 18:00" (live countdown).
- **Stats:** Participants, Registered today, Quiz submitted.
- **Timeline:** read-only `QuestTimeline`.
- **What's next:** one or two phase-aware actions. These don't duplicate the tab bar:

| Phase | Actions |
|---|---|
| upcoming | "Announce the opening" → broadcast with a draft |
| reading | "Remind readers" → broadcast with a draft |
| quiz | "Quiz is open — results on {date}" (info only) |
| finished | **"Start next edition"** → `/admin/quest/new`, plus "View results" |

- **No current quest:** an `EmptyState` with a "Start next edition" button.

## 7. Participants

- **URL search:** the query lives in the URL (`?q=`), so refresh and back keep it.
- **Load more instead of Prev/Next:** `useInfiniteQuery` over the page-based API (`getNextPageParam: page * limit < total ? page + 1 : undefined`). `ParticipantsPager` is deleted.
- **Contact actions:**
  - A Telegram handle opens `https://t.me/<handle>`, through `openTelegramLink` inside the Mini App so it stays inside Telegram.
  - A phone number opens `tel:`.
  - A copy button next to each contact copies it and shows the toast "Copied".
- **API search:** also matches `contact.value` (regex, already indexed per quest).

## 8. Results

This page only changes through the shared pieces: `AdminPageHeader` and `AdminQuery`.

## Out of scope

- CSV export of participants (a Telegram Mini App can't reliably download blobs; revisit with `downloadFile` when needed).
- Quiz management (`/admin/quiz`), which is its own plan.
- Telegram `429` back-off in the broadcast loop. The existing 35ms spacing stays.
- Hiding not-yet-opened editions from `GET /quests`. With the atomic `makeCurrent`, the admin UI never leaves one there, but the raw API still could.

## Constraints

- No automated tests, per the user's CLAUDE.md. Each change is verified with `pnpm typecheck`, the mock API (`VITE_MOCK_API=true`) and the manual checks in the plan.
- Backend naming: `*.routes.ts`, `*.controllers.ts`, `*.services.ts`. Validation with Zod.
- Comments: one-liners that explain *why*.
- Copy style: plain and warm, sentence case, no exclamation marks except in participant-facing broadcast suggestions.
