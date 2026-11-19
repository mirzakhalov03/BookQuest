# Prizes Poster & Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Prizes tab shows a poster (or a designed placeholder) plus a 1–5 written list, past quests become accordions that reveal their poster, and Profile's empty certificate state shrinks to one row.

**Architecture:** Front-end only. `PrizeShowcase` drops the podium branch. A new `PosterPlaceholder` and `PastQuestAccordion` replace `PrizePodium` and `QuestSummaryCard`. `CertificateTeaser` becomes a compact row.

**Tech Stack:** React, Tailwind, existing `QuestSummary`/`Prizes` types.

**Spec:** `docs/superpowers/specs/2026-11-20-prizes-poster-and-profile-design.md`

## Global Constraints

- No automated tests. Verify with `pnpm --filter @bookquest/web typecheck` plus the manual check.
- No API or schema changes.
- One accordion open at a time. Animations respect `prefers-reduced-motion`.
- Copy in `en`/`uz`/`ru`. Sans display. `frontend-design` for the placeholder.

## Review Focus

- A quest with `photoUrl` null **and** no prizes typed: the placeholder plus the "not announced yet" copy, with no empty list.
- Archive with zero past editions: the existing empty copy still shows.
- A very tall or very wide poster: no layout jump. Reserve the space with `aspect-ratio` from the loaded image, with 4:5 as the placeholder ratio.
- Keyboard: Tab to an accordion header, Enter/Space toggles, focus stays on the header.
- Profile, results out and a certificate exists but is still loading: no flash of the "missed" row (keep the current `data` handling).

---

### Task 1: Current prizes — poster or placeholder, then the list

**Files:**
- Create: `apps/web/src/features/prizes/components/PosterPlaceholder.tsx`
- Modify: `apps/web/src/features/prizes/components/PrizeShowcase.tsx`, `PrizeList.tsx`
- Delete: `apps/web/src/features/prizes/components/PrizePodium.tsx` (grep first, only `PrizeShowcase` should import it). Remove its CSS if it has any.
- Modify: `apps/web/src/i18n/{en,uz,ru}/{prizes,adminQuest}.ts`

**Interfaces:**
- `PrizeShowcase({ prizes, label })`: `photoUrl ? <PrizePhoto> : <PosterPlaceholder>`, then `<PrizeList prizes from={1} />` or the not-announced copy when every place is null.
- `PrizeList` renders `"{n}."` + prize, one row each.

- [ ] **Step 1:** Build `PosterPlaceholder` (4:5, gradient, `Trophy`, `prizes.posterSoon`).
- [ ] **Step 2:** Rewrite `PrizeShowcase`. Delete `PrizePodium`.
- [ ] **Step 3:** Rename the admin label to "Prize poster" in three languages.
- [ ] **Step 4:** Typecheck. Manual check (mock): with and without `photoUrl`, with 0, 3 and 5 prizes.
- [ ] **Step 5: Commit** `feat(prizes): poster replaces the podium, written 1–5 list below`

### Task 2: Past quests as accordions

**Files:**
- Create: `apps/web/src/features/prizes/components/PastQuestAccordion.tsx`
- Modify: `apps/web/src/features/prizes/components/PreviousQuests.tsx`
- Delete: `apps/web/src/features/prizes/components/QuestSummaryCard.tsx` if nothing else imports it
- Modify: `apps/web/src/i18n/{en,uz,ru}/prizes.ts`

**Interfaces:**
- `PastQuestAccordion({ quest, open, onToggle }: { quest: QuestSummary; open: boolean; onToggle: () => void })`.
- `PreviousQuestList` holds `openId: string | null`.

- [ ] **Step 1:** Header button: edition label, title, rotating chevron, `aria-expanded`, `aria-controls`.
- [ ] **Step 2:** Panel: `PrizePhoto` (summary poster) or `PrizeList` for 1–3, then a `Link` to `/quests/${edition}` (`prizes.fullEdition`). Height animation with the `grid-template-rows: 0fr → 1fr` trick. Reduced motion → no transition.
- [ ] **Step 3:** Typecheck. Manual check: open one, open another (the first closes), keyboard toggling, load more.
- [ ] **Step 4: Commit** `feat(prizes): past quests as accordions showing their prize poster`

### Task 3: Compact certificate row on Profile

**Files:**
- Modify: `apps/web/src/features/profile/components/CertificateTeaser.tsx`, `apps/web/src/features/profile/ProfilePage.tsx` (`CertificateSection`)
- Modify: the stylesheet holding `.cert-teaser*` (grep `cert-teaser`)
- Modify: `apps/web/src/i18n/{en,uz,ru}/profile.ts`

**Interfaces:**
- `CertificateTeaser({ resultsAt, missed }: { resultsAt: string | null; missed?: boolean })`: one row, lock icon, line 1 (`certTeaser` or `certMissed`), line 2 date (not when missed).

- [ ] **Step 1:** Rewrite the teaser as the compact row. Drop the `.cert-teaser__sheet` styles.
- [ ] **Step 2:** `CertificateSection` uses it for both no-certificate states.
- [ ] **Step 3:** Typecheck. Manual check: Profile before results, after results without a certificate, and with a certificate.
- [ ] **Step 4: Commit** `feat(profile): compact certificate row until one is earned`
