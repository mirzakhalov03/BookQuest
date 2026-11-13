# Book Reveal & Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can hide the current quest's book (readers see a `?` cover and a locked `/book`), and the Book page gets a "Where to find it" group of shop/library links.

**Architecture:** One `bookRevealed` flag on the quest. The public DTO (`toQuestDto`) withholds the whole `book` while it's false, so nothing leaks. The admin DTO always carries the book. The web app renders a shared `MysteryCover` wherever `quest.book` is null. Store links are a new `'store'` resource kind.

**Tech Stack:** Express + Mongoose + Zod (API), shared Zod schemas in `@bookquest/shared`, React + react-hook-form (web).

**Spec:** `docs/superpowers/specs/2026-11-12-book-reveal-and-sources-design.md`

## Global Constraints

- No automated tests (project rule). Verify with `pnpm typecheck` (all workspaces) plus the manual check per task.
- While hidden, **no** book field (title, author, pages, coverUrl, description, resources) appears in any public API response.
- Existing quests default to revealed (`bookRevealed: true`). The new-edition form defaults to hidden.
- Registration, countdown, prizes and quiz are unaffected by the flag.
- All new copy in `en`, `uz` and `ru` dictionaries (`apps/web/src/i18n/{en,uz,ru}/*.ts`).
- Display type is sans (project preference). Use `frontend-design` for the mystery cover.
- The web mock API (`apps/web/src/lib/api/mock/`) must stay in step with the new fields so `VITE_MOCK_API=true` keeps working.

## Review Focus

- `GET /api/v1/quests/current` with the book hidden: the JSON contains no title/author/cover string anywhere (search the raw body).
- An admin hides the book, saves, then edits only the prizes: the book must stay hidden (partial update must not reset the flag).
- Broadcast suggestions (`features/admin/broadcast/suggestions.ts`) read `quest.book`. They use the admin quest, so they must not crash or show "null".
- A reader who has `/book` open when the admin reveals sees the real book after pull-to-refresh, with no stale `?`.
- `BookCover` alt text/`aria-label` while hidden doesn't announce the real title.

---

### Task 1: Data contract and API masking

**Files:**
- Modify: `packages/shared/src/schemas/quest.ts` (`questSchema`)
- Modify: `packages/shared/src/schemas/admin.ts` (`updateQuestSchema`, `createQuestSchema`, `adminQuestSchema`)
- Modify: `packages/shared/src/constants/quest.ts` (`BOOK_RESOURCE_KINDS`)
- Modify: `apps/api/src/models/quest.model.ts`
- Modify: `apps/api/src/services/quest.services.ts` (`toQuestDto`, `toAdminQuestDto`, `createQuest`, `updateQuest`, `listPastQuests`)
- Modify: `apps/web/src/lib/api/mock/fixtures.ts` and mock routes/store that build quests

**Interfaces:**
- Produces:
  - `questSchema`: `bookRevealed: z.boolean()`, `book: bookSchema.nullable()`
  - `adminQuestSchema`: overrides `book: bookSchema` (never null) and keeps `bookRevealed`
  - `updateQuestSchema`: optional `bookRevealed: z.boolean()`. `createQuestSchema`: `bookRevealed: z.boolean().default(false)`
  - `BOOK_RESOURCE_KINDS = ['pdf', 'epub', 'audio', 'link', 'store'] as const`
  - `toAdminQuestDto` builds `book` itself instead of spreading a nullable one from `toQuestDto`. Extract a private `toBookDto(quest): Book` used by both.

- [ ] **Step 1:** Update the shared schemas and constant as above. Run `pnpm --filter @bookquest/shared build`.
- [ ] **Step 2:** Add `bookRevealed: { type: Boolean, default: true }` to the quest model schema. The model's resource `kind` enum already reads `BOOK_RESOURCE_KINDS`, so `'store'` flows through.
- [ ] **Step 3:** In `quest.services.ts`, add `toBookDto`. `toQuestDto` returns `bookRevealed` and `book: quest.bookRevealed === false ? null : toBookDto(quest)`. `toAdminQuestDto` returns `book: toBookDto(quest)`. `createQuest` persists `payload.bookRevealed`. `updateQuest` applies `bookRevealed` when present. In `listPastQuests`, add `bookRevealed: { $ne: false }` to the filter so a hidden quest can never reach the archive.
- [ ] **Step 4:** Update the web mock fixtures/store to include `bookRevealed` and to mask `book` the same way on the public route.
- [ ] **Step 5:** Run `pnpm typecheck`. Expected: errors **only** in web files reading `quest.book` (Home, Book page, etc.). Those are fixed in Tasks 3–4. API, shared and bot must be clean.
- [ ] **Step 6: Manual check.** With the API running against the local DB, set `bookRevealed: false` on the current quest (mongosh or the admin PATCH), then `curl -s $API/api/v1/quests/current | grep -ci "<book title>"`. Expected: `0`. `GET /admin/quest` still returns the full book.
- [ ] **Step 7: Commit**

```bash
git add packages/shared apps/api apps/web/src/lib/api/mock
git commit -m "feat(api): bookRevealed flag — public quest withholds the book while hidden; store resource kind"
```

### Task 2: Mystery cover component

**Files:**
- Create: `apps/web/src/components/MysteryCover.tsx`
- Modify: the stylesheet that holds `.cover-box`/book cover styles (`apps/web/src/styles/stage.css` or wherever `BookCover`'s classes live)

**Interfaces:**
- Produces: `MysteryCover({ className?: string }): JSX.Element`. It fills the same `.cover-box` frame `BookCover` does, so callers swap one for the other. It's `aria-label`led with `t.book.mysteryLabel` ("A secret book").

- [ ] **Step 1:** Design and build it with `frontend-design`: brand palette, large `?` in the display face (sans), a slow shimmer or float, `prefers-reduced-motion` → static. It should feel like a sealed gift, not a missing image.
- [ ] **Step 2:** Add `book.mysteryLabel` to en/uz/ru.
- [ ] **Step 3:** Run `pnpm --filter @bookquest/web typecheck` (ignore the Task 1 errors in pages not yet updated).
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/MysteryCover.tsx apps/web/src/styles apps/web/src/i18n
git commit -m "feat(web): MysteryCover for a hidden book"
```

### Task 3: Participant screens handle a hidden book

**Files:**
- Modify: `apps/web/src/features/home/HomePage.tsx`, `features/home/components/BookStage.tsx`, `features/home/components/Book3D.tsx`, `features/home/components/StageAside.tsx`
- Modify: `apps/web/src/features/book/BookPage.tsx`
- Modify: `apps/web/src/components/layout/TabBar.tsx` (lock badge)
- Modify: `apps/web/src/i18n/{en,uz,ru}/{home,book}.ts`

**Interfaces:**
- Consumes: `MysteryCover` (Task 2), `quest.book: Book | null`, `quest.bookRevealed: boolean` (Task 1).

- [ ] **Step 1: Home.** When `quest.book` is null, `BookStage` renders `MysteryCover` on the 3D book (give `BookStage`/`Book3D` an optional `mystery` prop or pass `book: Book | null`, whichever fits their current props). Left `StageAside` shows `t.home.revealedSoon` in place of title/author. Right `StageAside` hides the pages line. Countdown and `QuestAction` unchanged.
- [ ] **Step 2: `/book`.** When `quest.book` is null, render a locked screen: `MysteryCover`, heading `t.book.lockedTitle` ("The book is a secret, for now"), body `t.book.lockedBody` ("We'll reveal it soon. You'll get a notification."). No resources, no description.
- [ ] **Step 3: Tab bar.** When the current quest has `bookRevealed === false`, the Book tab shows a small `Lock` icon badge (lucide) over its icon. It still navigates.
- [ ] **Step 4:** Grep the web app for remaining `quest.book` reads on participant screens and guard each one. Make sure no `document.title` or share text uses the title while hidden.
- [ ] **Step 5:** Add the strings (`home.revealedSoon`, `book.lockedTitle`, `book.lockedBody`) in en/uz/ru.
- [ ] **Step 6:** Run `pnpm --filter @bookquest/web typecheck`. Expected: only admin-side errors remain (Task 4), or none.
- [ ] **Step 7: Manual check** (mock API with `bookRevealed: false`, then true): Home shows the `?` book and "Revealed soon", `/book` shows the locked screen, the Book tab has a lock. Flip to revealed, pull-to-refresh, and everything shows the real book.
- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): hidden-book state on Home, /book and the tab bar"
```

### Task 4: Admin toggle

**Files:**
- Modify: `apps/web/src/features/admin/quest/questForm.ts` (`QuestFormState`, initial values, patch builder)
- Modify: `apps/web/src/features/admin/quest/questFormSchema.ts`
- Modify: `apps/web/src/features/admin/quest/nextEdition.ts` (new-edition defaults + payload)
- Modify: `apps/web/src/features/admin/quest/components/BookFieldsSection.tsx`
- Modify: `apps/web/src/features/admin/quest/review.ts` and `components/ReviewChangesSheet.tsx`
- Modify: `apps/web/src/features/admin/quest/changes.ts` (count `bookRevealed` under the `book` section)
- Modify: `apps/web/src/features/admin/quest/components/QuestPreview.tsx`
- Modify: `apps/web/src/features/admin/DashboardPage.tsx` (hidden chip)
- Modify: `apps/web/src/i18n/{en,uz,ru}/{adminQuest,admin}.ts`

**Interfaces:**
- Consumes: `AdminQuest.bookRevealed`, `UpdateQuestPayload.bookRevealed`, `CreateQuestPayload.bookRevealed` (Task 1), `MysteryCover` (Task 2), `Switch` (`components/ui/Switch.tsx`).
- Produces: `QuestFormState.bookRevealed: boolean`.

- [ ] **Step 1:** Add `bookRevealed` to the form state. The initial value comes from `quest.bookRevealed`, and the new-edition default is `false`. The patch includes `bookRevealed` only when changed.
- [ ] **Step 2:** At the top of `BookFieldsSection`, add a `Switch` bound to `bookRevealed`, labelled `t.revealLabel` ("Show the book to readers"), with the hint `t.revealHint` ("Off: readers see a ? cover and /book stays locked. Use it to keep the book a surprise until you announce it.").
- [ ] **Step 3:** Review sheet: a line "Revealed the book" / "Hid the book" when it changed. After a reveal, show the nudge `t.revealNudge` ("Readers will see the book on their next refresh. Want to announce it?") with a link to `/admin/broadcast`. Nothing is sent automatically.
- [ ] **Step 4:** `QuestPreview` renders `MysteryCover` while the switch is off. The dashboard quest card shows a small "Book hidden" chip (`t.dashboard.bookHidden`) when `quest.bookRevealed === false`.
- [ ] **Step 5:** Add all strings in en/uz/ru.
- [ ] **Step 6:** Run `pnpm typecheck`. Expected: all workspaces pass.
- [ ] **Step 7: Manual check.** In the editor, switch off → preview shows `?` → save → the review sheet lists "Hid the book" → the dashboard shows the chip → the participant Home shows `?`. Then edit only a prize and save: the book stays hidden. Switch on → save → the nudge links to Broadcast. Start a new edition: the switch starts off.
- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(admin): show/hide the book toggle with preview, review line and dashboard chip"
```

### Task 5: "Where to find it" links

**Files:**
- Modify: `apps/web/src/features/book/components/ResourceList.tsx`
- Modify: `apps/web/src/features/book/components/ResourceIcon.tsx`
- Modify: `apps/web/src/features/admin/quest/components/ResourceListEditor.tsx` (kind select options)
- Modify: `apps/web/src/i18n/{en,uz,ru}/{book,adminQuest}.ts`

**Interfaces:**
- Consumes: `BookResourceKind` now including `'store'` (Task 1).

- [ ] **Step 1:** `ResourceIcon` maps `'store'` to lucide `MapPin` (or `Store`).
- [ ] **Step 2:** `ResourceList` splits resources into two groups, `t.book.readOrListen` (pdf/epub/audio/link) and `t.book.whereToFind` (store), each with its heading, keeping entry order within a group. A group with no items doesn't render.
- [ ] **Step 3:** `ResourceListEditor` offers `'store'` labelled `t.resources.kinds.store` ("Shop or library").
- [ ] **Step 4:** Add the strings in en/uz/ru. Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 5: Manual check.** Add a "store" link in the editor, save, and `/book` shows it under "Where to find it" with the pin icon. With only PDFs, there's no empty store heading.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(book): 'Where to find it' group with shop/library links"
```
