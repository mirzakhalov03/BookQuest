# Book Sources Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/book`'s flat link lists with four cards (e-book, movie, audiobook, buy offline). Each opens a sheet with steps and links, the movie card confirms before YouTube, and covers upload sharper.

**Architecture:** Cards are derived from existing resource kinds (plus a new `video` kind). Optional per-card step text lives on `book.guides`, with i18n defaults when null. One `SourceCards` component, one `SourceSheet`.

**Tech Stack:** Mongoose + Zod (shared), React, the existing `Sheet`, lucide icons.

**Spec:** `docs/superpowers/specs/2026-11-20-book-sources-cards-design.md`

## Global Constraints

- No automated tests. Verify with `pnpm typecheck` plus the manual check.
- `BOOK_RESOURCE_KINDS = ['pdf', 'epub', 'audio', 'link', 'store', 'video']`.
- Card → kinds: ebook = pdf/epub/link · movie = video · audio = audio · offline = store.
- `guides.*`: `string | null`, max 600 chars. Each non-empty line is one step.
- External links only through `openExternalLink` (`lib/telegram.ts`).
- Covers: max side 1600px, WebP quality 0.9. Other images unchanged.
- All copy in `en`/`uz`/`ru`. Sans display type. Design with `frontend-design`.
- Web mock fixtures carry `guides` and at least one resource per card plus one empty card.

## Review Focus

- A book with **no** resources at all: four dimmed cards, no crash. The old empty-state copy is gone or reused.
- Hidden book (`quest.book === null`): `BookLocked` still renders. The cards never mount.
- Steps text with blank lines, leading "1." numbers or trailing spaces: rendered as clean steps, no "1. 1." doubling (strip a leading `\d+[.)]\s*`).
- Movie confirm, then the user closes the sheet: reopening starts at the list, not the confirm step.
- Long Uzbek labels ("Alisher Navoiy nomidagi Milliy kutubxona") wrap inside the card and sheet with no overflow at 360px.

---

### Task 1: Data — `video` kind and `guides`

**Files:**
- Modify: `packages/shared/src/constants/quest.ts`, `packages/shared/src/schemas/quest.ts` (`bookSchema`), `packages/shared/src/schemas/admin.ts` (update/create quest)
- Modify: `apps/api/src/models/quest.model.ts`, `apps/api/src/services/quest.services.ts` (`toBookDto`, `updateQuest`, `createQuest`)
- Modify: `apps/web/src/lib/api/mock/fixtures.ts`

**Interfaces:**
- Produces: `SOURCE_CARDS = ['ebook', 'movie', 'audio', 'offline'] as const`, `type SourceCard`, `SOURCE_CARD_KINDS: Record<SourceCard, readonly BookResourceKind[]>` in `packages/shared/src/constants/quest.ts`.
- `bookGuidesSchema = z.object({ ebook, movie, audio, offline })`, each `z.string().max(600).nullable()`. `bookSchema.guides: bookGuidesSchema`.

- [ ] **Step 1:** Shared constants and schemas, then `pnpm --filter @bookquest/shared build`.
- [ ] **Step 2:** Model: `guides: { ebook: {type:String, default:null}, … }`. DTO maps it (missing → all null). Update/create accept a partial `guides`.
- [ ] **Step 3:** Mock fixtures.
- [ ] **Step 4:** `pnpm typecheck` clean.
- [ ] **Step 5: Commit** `feat(api): video resource kind and per-card book guides`

### Task 2: Participant cards and sheet

**Files:**
- Create: `apps/web/src/features/book/components/SourceCards.tsx`, `SourceSheet.tsx`, `apps/web/src/features/book/sourceSteps.ts`
- Delete: `apps/web/src/features/book/components/ResourceList.tsx` (after moving its link row into `SourceSheet`)
- Modify: `apps/web/src/features/book/BookPage.tsx`, `apps/web/src/components/ResourceIcon.tsx` (`video`), `apps/web/src/lib/telegram.ts` (add `haptic(style: 'light')` if not present)
- Modify: `apps/web/src/i18n/{en,uz,ru}/book.ts`

**Interfaces:**
- Consumes: `SOURCE_CARDS`, `SOURCE_CARD_KINDS`, `book.guides` (Task 1).
- Produces: `sourceSteps(guide: string | null, fallback: readonly string[]): string[]`: splits on newlines, trims, drops empty lines, strips a leading `^\d+[.)]\s*`, falls back when the result is empty.
- `SourceCards({ book }: { book: Book })` and `SourceSheet({ card, book, open, onClose })`.

- [ ] **Step 1:** `sourceSteps` plus the i18n defaults (`book.cards.<card>.title`, `.hint(n)`, `.empty`, `.defaultSteps: string[]`).
- [ ] **Step 2:** `SourceCards`: grid (`grid-cols-1 sm:grid-cols-2`), ~100px tall cards, tinted icon tile, count hint, chevron. Empty → dimmed + `aria-disabled`, no handler. Press → haptic. Design with `frontend-design`.
- [ ] **Step 3:** `SourceSheet`: header (icon, title, book title), numbered steps, link rows (label + hostname via `new URL(url).hostname`). Movie: local `confirmUrl` state. A row tap sets it and the body swaps to the confirm copy with **Open YouTube** (→ `openExternalLink`, then close) and **Stay**. Reset `confirmUrl` when `open` turns false.
- [ ] **Step 4:** `BookPage` renders `<SourceCards book={quest.book} />` in place of `ResourceList`.
- [ ] **Step 5:** `pnpm --filter @bookquest/web typecheck`. Manual check (mock API, 360px and desktop): the four cards, one dimmed, each sheet shows steps and links, movie confirm works, external links open.
- [ ] **Step 6: Commit** `feat(book): four where-to-get-it cards with step-by-step sheets`

### Task 3: Admin — video kind, card steps, sharper covers

**Files:**
- Modify: `apps/web/src/features/admin/quest/components/ResourceListEditor.tsx` (`kindOptions`)
- Modify: `apps/web/src/features/admin/quest/components/BookFieldsSection.tsx`, `questForm.ts`, `questFormSchema.ts`, `changes.ts`, `review.ts`
- Modify: `apps/web/src/features/admin/quest/components/ImagePicker.tsx` callers (cover passes `maxSide={1600}` and a new `quality={0.9}`), `apps/web/src/lib/downscaleImage.ts` (accept `quality`)
- Modify: `apps/web/src/i18n/{en,uz,ru}/adminQuest.ts`

**Interfaces:**
- Consumes: `bookGuidesSchema` (Task 1), the i18n default steps (Task 2) as placeholders.
- `downscaleImage(file: File, maxSide = 1000, quality = 0.82): Promise<File>`.

- [ ] **Step 1:** Add "Movie / video" to the kind options.
- [ ] **Step 2:** A "Card steps" group in `BookFieldsSection` with four `TextArea`s, placeholders joined from the default steps, wired into the form state, patch builder and the review list ("Changed the e-book steps").
- [ ] **Step 3:** Cover quality params.
- [ ] **Step 4:** `pnpm typecheck`. Manual check: add a video link plus custom offline steps, save, and see them on `/book`. Re-upload a cover and confirm the stored image is 1600px on its long side.
- [ ] **Step 5: Commit** `feat(admin): movie links, card steps and sharper cover uploads`

### Task 4: Content (organisers, no code)

- [ ] In prod admin: upload the high-res cover, write the description, add e-book/audio/movie/shop links (HilolNashr partners). Check `/book` on a phone.
