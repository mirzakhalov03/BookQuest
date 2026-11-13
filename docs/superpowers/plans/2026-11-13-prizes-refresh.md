# Prizes Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prizes for 5 places, an optional prize photo with podium fallback, past editions showing their prizes, and a Home card that leads to Prizes.

**Architecture:** `prizesSchema` grows `fourth`, `fifth` and `photoUrl`. A single shared `PRIZE_PLACES` list drives the admin form, the podium, the ranked list, the archive line and the Home CTA. The photo reuses the cover upload pipeline.

**Tech Stack:** Express + Mongoose + Zod, shared Zod schemas, React + react-hook-form + React Query.

**Spec:** `docs/superpowers/specs/2026-11-12-prizes-refresh-design.md`

## Global Constraints

- No automated tests (project rule). Verify with `pnpm typecheck` plus the manual check per task.
- Existing quest documents need no migration: missing `fourth`/`fifth`/`photoUrl` read as `null`.
- Certificates are unchanged: tiers stay 1–3. 4th/5th get the participant tier.
- The CTA is hidden when no prize is set and in the `finished` phase.
- All new copy in en/uz/ru. Sans display type. The CTA and the ranked list are designed with `frontend-design`.
- Keep the web mock API in step with the new fields.

## Review Focus

- Only 1st and 5th set, 2nd–4th empty: the list shows 1–3 with "To be announced" for 2–3, hides 4th, shows 5th, and the CTA says "+1 more prize" (singular).
- A very long prize name (e.g. 200 chars) on the CTA and archive line truncates cleanly to one line, with no layout blow-out.
- Removing the prize photo in admin falls back to the podium on the next refresh, and the old image file is discarded the way unused covers are.
- A past edition with no prizes at all: the archive card shows no prize line and no stray "🏆".
- The Home CTA while the book is hidden (book reveal spec) still shows. Prizes don't depend on the book.

---

### Task 1: Data contract — 5 places and photo

**Files:**
- Modify: `packages/shared/src/schemas/quest.ts` (`prizesSchema`, `questSummarySchema`)
- Create: `packages/shared/src/constants/prizes.ts` (export from `constants/index.ts`)
- Modify: `packages/shared/src/schemas/admin.ts` (`prizeFields`)
- Modify: `apps/api/src/models/quest.model.ts` (`prizesSchema`)
- Modify: `apps/api/src/services/quest.services.ts` (`toQuestDto`, `toQuestSummary`, `listPastQuests` projection, `updateQuest` prize merge)
- Modify: `apps/web/src/lib/api/mock/*` (fixtures + archive)

**Interfaces:**
- Produces:
  - `PRIZE_PLACES = [{ key: 'first', rank: 1 }, { key: 'second', rank: 2 }, { key: 'third', rank: 3 }, { key: 'fourth', rank: 4 }, { key: 'fifth', rank: 5 }] as const`, `type PrizePlaceKey`
  - `prizesSchema`: adds `fourth`, `fifth: z.string().nullable()`, `photoUrl: z.string().url().nullable()`
  - `hasAnyPrize(prizes: Prizes): boolean` and `countPrizes(prizes: Prizes): number` in `constants/prizes.ts`
  - `questSummarySchema.prizes: prizesSchema`
  - Admin `prizeFields`: `fourth`, `fifth` (same rule as `first`), `photoUrl: z.string().url().nullable()`

- [ ] **Step 1:** Make the shared changes and build shared (`pnpm --filter @bookquest/shared build`).
- [ ] **Step 2:** Add `fourth`, `fifth` and `photoUrl` (default `null`) to the model. `toQuestDto` maps them with `?? null` and runs `photoUrl` through `toPublicCoverUrl`. `updateQuest` stores `photoUrl` via `toStoredCoverUrl`, the same as `book.coverUrl`. `toQuestSummary` includes `prizes`, and the `listPastQuests` projection selects `prizes`.
- [ ] **Step 3:** In `cover.services.ts`'s unused-cover sweep (line ~86), also collect ids referenced by `quest.prizes.photoUrl`, so a prize photo is never treated as orphaned.
- [ ] **Step 4:** Update the mock fixtures.
- [ ] **Step 5:** Run `pnpm typecheck`. Expected: API/shared clean. Web errors only where `Prizes` objects are built (fixed in Task 2).
- [ ] **Step 6: Commit**

```bash
git add packages/shared apps/api apps/web/src/lib/api/mock
git commit -m "feat(api): prizes for 4th and 5th place, prize photo, prizes on archive summaries"
```

### Task 2: Admin prize form

**Files:**
- Modify: `apps/web/src/features/admin/quest/questForm.ts`, `questFormSchema.ts`, `nextEdition.ts`, `review.ts`
- Modify: `apps/web/src/features/admin/quest/components/PrizeFieldsSection.tsx`
- Modify: `apps/web/src/features/admin/quest/components/CoverPicker.tsx` (generalise) or create `components/ImagePicker.tsx`
- Modify: `apps/web/src/i18n/{en,uz,ru}/adminQuest.ts`

**Interfaces:**
- Consumes: `PRIZE_PLACES` (Task 1), `useUploadCover` (exists).
- Produces: `QuestFormState.prizes: Record<PrizePlaceKey, string> & { photoUrl: string }`.

- [ ] **Step 1:** Replace the hand-written `first/second/third` handling in `questForm.ts`, `questFormSchema.ts`, `nextEdition.ts` and `review.ts` with loops over `PRIZE_PLACES` (plus `photoUrl`), so adding a place never means editing four files again.
- [ ] **Step 2:** `PrizeFieldsSection` renders the photo picker first ("Add a photo of the prizes", replace/remove), then one `Field` per `PRIZE_PLACES` entry. Generalise `CoverPicker` into an image picker with an aspect prop rather than copying it. Builder's call on the name.
- [ ] **Step 3:** Add `prizes.fourth`, `prizes.fifth`, their placeholders and the photo picker copy in en/uz/ru.
- [ ] **Step 4:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 5: Manual check.** Set all five prizes and a photo, save, and the review sheet lists each changed place. Clear 4th and save: it's stored as `null`. Remove the photo: it saves as `null`.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(admin): five prize places and a prize photo in the quest editor"
```

### Task 3: Prizes page — photo + ranked list, or podium + rows

**Files:**
- Create: `apps/web/src/features/prizes/components/PrizeList.tsx`
- Modify: `apps/web/src/features/prizes/components/PrizePodium.tsx` (use `PRIZE_PLACES.slice(0, 3)`, drop local `PLACES`/`hasAnyPrize`)
- Modify: `apps/web/src/features/prizes/components/CurrentPrizes.tsx`
- Modify: `apps/web/src/features/prizes/QuestEditionPage.tsx` (show the prize list)
- Modify: the prizes stylesheet holding `.prize-podium` (find with `grep -rn "prize-podium" apps/web/src/styles`)
- Modify: `apps/web/src/i18n/{en,uz,ru}/{prizes,ordinal}.ts` as needed

**Interfaces:**
- Consumes: `PRIZE_PLACES`, `hasAnyPrize` (Task 1).
- Produces: `PrizeList({ prizes: Prizes; from?: 1 | 4 }): JSX.Element`. It renders ranked rows from place `from` to 5, with 1–3 tinted gold/silver/bronze, 1–3 shown as "To be announced" when null, and 4–5 omitted when null.

- [ ] **Step 1:** Build `PrizeList` (designed with `frontend-design`): rank numeral, place label, prize text, one visual system.
- [ ] **Step 2:** `CurrentPrizes`: with `prizes.photoUrl`, render the photo full-width (rounded, edition label over the bottom edge, `alt` = `t.prizes.photoAlt`), then `<PrizeList prizes from={1} />`. Without a photo, render `<PrizePodium />` then `<PrizeList prizes from={4} />`.
- [ ] **Step 3:** `QuestEditionPage` shows the past edition's prizes with the same rule.
- [ ] **Step 4:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 5: Manual check** with the mock API: photo + 5 prizes; no photo + 5 prizes; no photo + only 1–3; only 1st and 5th (see Review Focus). Each looks deliberate at 360px and at desktop width.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(prizes): prize photo with ranked list, podium fallback with 4th–5th rows"
```

### Task 4: Previous quests show their prizes

**Files:**
- Modify: `apps/web/src/features/prizes/components/QuestSummaryCard.tsx`
- Modify: `apps/web/src/i18n/{en,uz,ru}/prizes.ts`

**Interfaces:**
- Consumes: `QuestSummary.prizes` (Task 1).

- [ ] **Step 1:** Under the readers line, render one truncated line (`truncate`) of the non-null 1st→3rd prizes joined with " · ", prefixed by a small `Trophy` icon (lucide, `aria-hidden`), with an sr-only label `t.prizes.prizesGiven`. Omit the line when all three are null.
- [ ] **Step 2:** Keep the section secondary: the heading stays `type-label`, the thumbnails stay as is.
- [ ] **Step 3:** Run `pnpm typecheck`. Manual check: the archive shows the prize line, and a card with no prizes has no line.
- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(prizes): show what past editions gave on archive cards"
```

### Task 5: Home → Prizes CTA

**Files:**
- Create: `apps/web/src/features/home/components/PrizesCta.tsx`
- Modify: `apps/web/src/features/home/HomePage.tsx` (render under `QuestAction`)
- Modify: the home stylesheet (`apps/web/src/styles/stage.css` or the home styles file) if it needs a keyframe
- Modify: `apps/web/src/i18n/{en,uz,ru}/home.ts`

**Interfaces:**
- Consumes: `hasAnyPrize`, `countPrizes`, `PRIZE_PLACES` (Task 1), `haptic` from `@/lib/telegram`.
- Produces: `PrizesCta({ prizes: Prizes; phase: QuestPhase }): JSX.Element | null`.

- [ ] **Step 1:** Return `null` when `!hasAnyPrize(prizes)` or `phase === 'finished'`.
- [ ] **Step 2:** Render a `Link` to `/prizes` with `onClick={() => haptic('select')}`. The headline is `t.home.winPrize(topPrize)`, where `topPrize` is the first non-null place in `PRIZE_PLACES` order. Below it, `t.home.morePrizes(n)` with `n = countPrizes(prizes) - 1` (pluralised via `i18n/plural.ts`, hidden when 0). Add a trophy icon, an arrow, and a `photoUrl` thumbnail when present. Design with `frontend-design`: secondary to `QuestAction`, warm orange/gold accent, one shine on first paint, static under `prefers-reduced-motion`.
- [ ] **Step 3:** Add `home.winPrize` and `home.morePrizes` in en/uz/ru.
- [ ] **Step 4:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 5: Manual check.** The CTA appears in the upcoming/reading/quiz phases and is gone in finished and with no prizes. A tap lands on `/prizes` (with a haptic in Telegram). Long prize text truncates.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(home): prizes CTA card leading to the Prizes tab"
```
