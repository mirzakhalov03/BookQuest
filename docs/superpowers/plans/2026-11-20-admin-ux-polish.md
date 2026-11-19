# Admin UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All admin destinations on the laptop bar, a designed custom `Select` everywhere, a white date icon, errors only after a save attempt, creative placeholders, a tidier quiz editor, and broadcast history as a table.

**Architecture:** Front-end only. `Select` keeps its public props and swaps its internals for a portal listbox, so every caller upgrades at once. Validation moves to `mode: 'onSubmit'` + `reValidateMode: 'onChange'`, with quiz issues gated on `isSubmitted || !isNew`.

**Tech Stack:** React, react-hook-form, dnd-kit, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-20-admin-ux-polish-design.md`

## Global Constraints

- No automated tests. Verify with `pnpm --filter @bookquest/web typecheck` plus the manual check.
- No new dependencies.
- `Select` props stay compatible: `label`, `value`, `options: { value; label; hint? }[]`, `onChange`, `className`, `disabled`.
- Laptop breakpoint: Tailwind `lg` (1024px).
- Copy in `en`/`uz`/`ru`. Placeholders are written per language, not translated literally.

## Review Focus

- `Select` inside a `Sheet` (resource editor rows, the quiz config) and inside the scrolling interactions table: the popover isn't clipped, and closes when its container scrolls.
- `Select` with a value not in `options` (a stale saved quiz id): the trigger shows a neutral "Choose…" with no crash.
- The quest editor's review sheet and unsaved-changes guard still detect changes after switching validation modes (`isDirty` is independent of `mode`; confirm).
- Adding a question while another is open and long: the scroll lands on the new card, not halfway.
- Broadcast with `dmCount = 0` (in-app only): the Telegram cell shows "—", not `0/0`.

---

### Task 1: Laptop navbar

**Files:** Modify `apps/web/src/layouts/AdminLayout.tsx`

**Interfaces:** `const TABS: (Tab & { primary: boolean })[]` replaces `PRIMARY_TABS`/`MORE_TABS`.

- [ ] **Step 1:** Render every tab in the bar. Non-primary tabs get `hidden lg:flex`, and the More button gets `lg:hidden`. The More sheet lists non-primary tabs. `inMore` is computed from non-primary tabs.
- [ ] **Step 2:** Check that `.tabbar` (`styles/shell.css`) lays out 8 items at ≥1024px without squeezing labels. Adjust the gap or max-width at `lg` if needed.
- [ ] **Step 3:** Typecheck. Manual check at 1280px (8 tabs, no More) and 375px (4 plus More, sheet works, active state correct).
- [ ] **Step 4: Commit** `feat(admin): every section on the bar at laptop width`

### Task 2: Custom `Select`

**Files:**
- Modify: `apps/web/src/components/ui/Select.tsx`
- Create: `apps/web/src/hooks/useAnchoredPosition.ts`
- Modify: `apps/web/src/features/admin/quest/components/QuizConfigSection.tsx` (pass `hint` per quiz option: question count and status)
- Modify: `apps/web/src/i18n/{en,uz,ru}/common.ts` (`choose`)

**Interfaces:**
- `SelectOption<V> = { value: V; label: string; hint?: string }`.
- `useAnchoredPosition(anchor: RefObject<HTMLElement>, open: boolean, maxHeight = 288): { top: number; left: number; width: number; placement: 'below' | 'above' }`: recomputes on open, resize and scroll (capture phase). Flips above when the space below is smaller than `min(maxHeight, listHeight)`.

- [ ] **Step 1:** The hook.
- [ ] **Step 2:** The component: a button trigger (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-labelledby` the label), and a portal (`createPortal` to `document.body`) `ul role="listbox"` with `li role="option" aria-selected`. Active index state, keyboard map per spec §2, type-ahead (first letter, cycles), outside pointerdown and ancestor scroll close it, Esc restores focus. Styling: `Field` surface classes, `ash` popover, 150ms fade and translate, check icon on the selected option, `hint` in `text-taupe text-xs`.
- [ ] **Step 3:** Quiz picker hints.
- [ ] **Step 4:** Typecheck. Manual check of every caller: interaction filters (5), resource kind (in a sheet), quiz config (2), live quiz filters (2). Mouse, keyboard only, and touch emulation, plus near the bottom of the viewport (flips up).
- [ ] **Step 5: Commit** `feat(ui): custom Select — portal listbox with full keyboard support`

### Task 3: White date icon

**Files:** Modify `apps/web/src/styles/base.css`

- [ ] **Step 1:** `input[type='datetime-local'], input[type='date'] { color-scheme: dark; }` plus `::-webkit-calendar-picker-indicator { filter: invert(1); opacity: .8; cursor: pointer; }`.
- [ ] **Step 2:** Manual check in Chrome and Safari: the icon is white on the quest editor's date fields.
- [ ] **Step 3: Commit** `fix(admin): white calendar icon on date fields`

### Task 4: Calm validation and creative placeholders

**Files:**
- Modify: `apps/web/src/features/admin/quest/QuestEditorPage.tsx`, `quest/NewEditionPage.tsx`, `quizzes/QuizEditorPage.tsx` (`useForm` options)
- Modify: `apps/web/src/features/admin/quizzes/quizForm.ts` (`newQuestion` sets `isNew: true`. Strip `isNew` in the payload builder)
- Modify: `apps/web/src/features/admin/quizzes/components/QuestionList.tsx` (gate `issuesFor` + the warning icon)
- Modify: every admin `Field`/`TextArea` without a placeholder in `features/admin/quest/components/*`, `features/admin/quizzes/components/*`, `features/admin/broadcast/*`
- Modify: `apps/web/src/i18n/{en,uz,ru}/{adminQuest,adminQuiz,admin}.ts` (a `placeholders` group per dictionary)

**Interfaces:**
- The quiz form question type gains `isNew?: boolean` (client-only, never sent). `QuestionList` receives `showIssues: (question) => boolean = q => formState.isSubmitted || !q.isNew`.

- [ ] **Step 1:** Switch the three forms to `mode: 'onSubmit', reValidateMode: 'onChange'`.
- [ ] **Step 2:** `isNew` flag plus gating. Confirm the save bar's error count still appears after a failed save.
- [ ] **Step 3:** Placeholders (examples in spec §4), written per language.
- [ ] **Step 4:** Typecheck. Manual check: open a new edition with no red. Save empty → errors appear. Fix one → it clears live. A new quiz question shows no amber until save. An old broken question shows amber straight away.
- [ ] **Step 5: Commit** `feat(admin): errors only after a save attempt; creative placeholders`

### Task 5: Quiz editor tidy-up

**Files:** Modify `apps/web/src/features/admin/quizzes/components/QuestionList.tsx`, `QuestionEditor.tsx` (focus target), `apps/web/src/i18n/*/adminQuiz.ts` (remove the move-up/down labels)

- [ ] **Step 1:** `addQuestion`: after `append` + `setOpenId`, `requestAnimationFrame(() => { el = document.getElementById(\`q-${next.id}\`); el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); el?.querySelector('textarea, input')?.focus({ preventScroll: true }) })`. Give each row `id={\`q-${field.id}\`}`. Read `reduced` from `matchMedia('(prefers-reduced-motion: reduce)')`.
- [ ] **Step 2:** Remove the ArrowUp/ArrowDown buttons, the `onMove` prop and their imports. Make sure dnd-kit's `KeyboardSensor` with `sortableKeyboardCoordinates` is registered.
- [ ] **Step 3:** Remove the `{seconds}s` span and the now-unused `defaultTime` prop if nothing else needs it.
- [ ] **Step 4:** Typecheck. Manual check: add a question at the bottom of a long list (smooth scroll and focus). Drag reorder. Keyboard reorder (Space, arrows, Space).
- [ ] **Step 5: Commit** `feat(admin): scroll to new question; drop arrows and per-question time`

### Task 6: Broadcast — no announce, table history

**Files:**
- Modify: `apps/web/src/features/admin/broadcast/suggestions.ts`, `BroadcastPage.tsx` (hide an empty suggestions block)
- Modify: `apps/web/src/features/admin/broadcast/components/BroadcastHistory.tsx`
- Modify: `apps/web/src/i18n/{en,uz,ru}/admin.ts`

**Interfaces:** `telegramRatio(b: Broadcast): string | null` → `"2/2"` or null when `dmCount === 0`.

- [ ] **Step 1:** Remove the `upcoming` case (return `[]`) and the `announce`/`announceText` keys. Confirm the suggestions UI hides when empty.
- [ ] **Step 2:** History: `<table>` at `sm:` and above with Sent, Message (`truncate`, click toggles `line-clamp-none`), Telegram (`tabular-nums`, sage when equal, amber when lower, `—` when null, `title` = full sentence), Status chip (tones from the existing `TONE`). Below `sm`, the same data as two-line cards.
- [ ] **Step 3:** Typecheck. Manual check (mock): sending, sent and interrupted rows, an in-app-only row, desktop and phone.
- [ ] **Step 4: Commit** `feat(admin): broadcast history as a table; drop the opening announcement`
