# Admin Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/admin` a mobile-first, low-friction tool. Rebuild the quest editor (react-hook-form, collapsible sections, save bar, date timeline, paste-first resources, review sheet, preview), add "Start next edition", move broadcast delivery to the background with progress, and rework the Dashboard and Participants.

**Architecture:** Shared web primitives (`Sheet`, `TextArea`, `Select`, `SearchInput`, `AdminQuery`, `AdminPageHeader`) come first. On top of them:
- **Quest editor:** one `QuestFormFields` tree reads `useFormContext`, and both the edit page and the new-edition page render it. `buildQuestPatch` stays the single diff, and `summarizeChanges` derives the change count and section dots from it.
- **API:** two contract changes. `POST /admin/quests` gains an atomic `makeCurrent`. Broadcasts answer `202`, deliver in the background, and expose `GET /admin/broadcasts` for polling.

**Tech Stack:** React 19, React Router (data router), TanStack Query 5, Zustand, Tailwind 4, react-hook-form 7, @hookform/resolvers 5, Zod 4; Express 5, Mongoose 9, Zod 4.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-redesign-design.md`

## Global Constraints

- **No automated tests** (user's CLAUDE.md). Each task is verified with `pnpm typecheck` from the repo root (turbo builds `@bookquest/shared` first) plus the manual checks it lists.
- **Manual checks** run against the mock API: `VITE_MOCK_API=true pnpm --filter @bookquest/web dev`. Check at **390×844** (DevTools device mode) and at **1280×800**. The mock session is an admin.
- **Backend naming:** `*.routes.ts`, `*.controllers.ts`, `*.services.ts`. Validation with Zod.
- **Comments:** one-liners that explain *why*. Don't restate the code.
- **Error colour:** only the tokens `text-error` / `border-b-error-line`. No hex literals after Task 1.
- **Breakpoints:** `sm` 640px, `lg` 1024px, and `900px` (where the tab bar floats; hard-coded in `stage.css` / `shell.css`).
- **Tab roots** (`/admin`, `/admin/participants`, `/admin/quest`, `/admin/results`, `/admin/broadcast`) never call `useTelegramBackButton`. `/admin/quest/new` calls it with `'/admin/quest'`.
- **Dates:** form values are `datetime-local` strings from `toDateTimeLocalInput`. `new Date(value)` reads them back in the local zone.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only the files the task names.
- **Git branch:** do this work on `feat/admin-redesign`, not `main`.

## Review Focus

1. **Stale navigation guard after create.** The new-edition page navigates away right after a successful create while `isDirty` is still true in the last render. The guard must read `bypass` from a ref, or the admin gets a "Discard?" sheet for work they just saved. Task 9, Step 6 checks this.
2. **Date errors on the field you didn't touch.** With a resolver, react-hook-form only updates errors for the field that changed. Ordering errors land on a *different* date, so the `dates` object must be validated as one `Controller` value. Task 5, Step 4 moves `opensAt` past `readingDeadline` and expects the error under Reading deadline.
3. **Old broadcast rows.** Broadcasts saved before this change have no `status`. The schema default must be `'sent'` (not `'sending'`), or history polls forever and the boot sweep marks old broadcasts `interrupted`. Task 10, Step 5 checks this against a pre-existing row.
4. **Invalid `datetime-local` text.** A half-typed or cleared date must not crash the summaries, the timeline gaps or the preview (`Intl` throws `RangeError` on Invalid Date). Task 4, Step 7 and Task 5, Step 4 clear a date field.
5. **A collapsed section with an error.** Save with an error in a closed section must open that section and focus the field. Task 4, Step 7 checks this with an empty title while Book is collapsed.

---

## File Structure

```
packages/shared/src/schemas/admin.ts                 mod  AdminStats.phase: QuestPhase; createQuestSchema.makeCurrent
packages/shared/src/schemas/notification.ts          mod  BROADCAST_MAX_LENGTH, statuses, progress fields, BroadcastList

apps/api/src/services/quest.services.ts              mod  createQuest honours makeCurrent (transaction)
apps/api/src/controllers/admin/quest.controllers.ts  mod  audit makeCurrent
apps/api/src/models/broadcast.model.ts               mod  status/dmCount/sentCount/failedCount/completedAt
apps/api/src/services/broadcast.services.ts          mod  background delivery, listBroadcasts, markInterruptedBroadcasts
apps/api/src/controllers/admin/broadcast.controllers.ts  mod  202 + list
apps/api/src/routes/admin/broadcast.routes.ts        mod  GET /
apps/api/src/server.ts                               mod  boot sweep
apps/api/src/services/admin.services.ts              mod  search contact.value
apps/api/src/validators/admin.validators.ts          mod  comment only

apps/web/src/styles/theme.css                        mod  error tokens
apps/web/src/styles/base.css                         mod  --safe-t
apps/web/src/styles/shell.css                        mod  .sheet, .admin-savebar
apps/web/src/lib/format.ts                           mod  formatShortDate
apps/web/src/lib/telegram.ts                         mod  openTelegramLink
apps/web/src/hooks/useMediaQuery.ts                  new
apps/web/src/hooks/useUnsavedChangesGuard.ts         new
apps/web/src/hooks/useSaveShortcut.ts                new
apps/web/src/components/ui/Field.tsx                 mod  fieldLineClass, statusFor, hideLabel
apps/web/src/components/ui/TextArea.tsx              new
apps/web/src/components/ui/Select.tsx                new
apps/web/src/components/ui/SearchInput.tsx          new
apps/web/src/components/ui/Sheet.tsx                 new
apps/web/src/components/BookHero.tsx                 mod  titleAs
apps/web/src/app/router.tsx                          mod  new paths + quest/new
apps/web/src/layouts/AdminLayout.tsx                 mod  --safe-t
apps/web/src/lib/api/mock/routes.ts                  mod  makeCurrent, broadcasts, contact search

apps/web/src/features/admin/
  phase.ts                          new  PHASE_LABEL, nextMilestone
  dates.ts                          new  DATE_LABEL, GAP_LABEL, parseLocal, formatGap, questDates,
                                         shiftLaterDates, defaultDates, plusOneYear
  api/adminKeys.ts                  mod  participants({q,limit}), latestQuest, broadcasts
  api/useAdminParticipants.ts       mod  infinite
  api/useLatestQuest.ts             new
  api/useCreateQuest.ts             new
  api/useBroadcasts.ts              new
  api/useSendBroadcast.ts           mod  invalidate history
  components/AdminPageHeader.tsx    new
  components/AdminQuery.tsx         new
  components/SaveBar.tsx            new
  components/UnsavedChangesSheet.tsx new
  components/QuestTimeline.tsx      new
  components/ContactLink.tsx        new
  components/ParticipantsTable.tsx  mod  ContactLink
  components/ParticipantsPager.tsx  DEL
  DashboardPage.tsx                 rewrite
  ParticipantsPage.tsx              rewrite
  ResultsInspectionPage.tsx         mod  AdminQuery + header, no back button
  broadcast/BroadcastPage.tsx       moved from features/admin/BroadcastPage.tsx, rewrite
  broadcast/suggestions.ts          new
  broadcast/components/MessagePreview.tsx   new
  broadcast/components/BroadcastHistory.tsx new
  quest/                            the editor, moved out of features/admin/
    questForm.ts                    moved + exported helpers
    questFormSchema.ts              new
    serverErrors.ts                 new
    changes.ts                      new
    summaries.ts                    new
    review.ts                       new
    resources.ts                    new
    nextEdition.ts                  new
    QuestEditorPage.tsx             moved, rewrite
    NewEditionPage.tsx              new
    components/QuestFormFields.tsx  new
    components/EditorSection.tsx    new
    components/BookFieldsSection.tsx     moved, rewrite
    components/CoverPicker.tsx           moved (import path only)
    components/ResourceListEditor.tsx    moved, rewrite
    components/PrizeFieldsSection.tsx    moved, rewrite
    components/QuizMetaFieldsSection.tsx moved, rewrite
    components/DateTimelineField.tsx     new (replaces QuestDateFieldsSection.tsx, deleted)
    components/ReviewChangesSheet.tsx    new
    components/QuestPreview.tsx          new
```

Task order and phases (each phase ships on its own):

| Phase | Tasks | Ships |
|---|---|---|
| A · Foundations | 1–2 | Primitives, shell fixes, phase labels |
| B · Quest editor | 3–8 | New editor |
| C · Next edition | 9 | Start next edition, end to end |
| D · Broadcast | 10–11 | Background delivery, history, composer |
| E · Dashboard & roster | 12–13 | Dashboard, Participants |
| F · Wrap-up | 14 | Docs, full walkthrough |

---

## Phase A · Foundations

### Task 1: Tokens, safe area and UI primitives

**Files:**
- Modify: `apps/web/src/styles/theme.css`, `apps/web/src/styles/base.css`, `apps/web/src/styles/shell.css`
- Modify: `apps/web/src/components/ui/Field.tsx`, `apps/web/src/lib/format.ts`, `apps/web/src/lib/telegram.ts`
- Modify (hex → token): every file `grep` finds in Step 2
- Create: `apps/web/src/components/ui/TextArea.tsx`, `Select.tsx`, `SearchInput.tsx`, `Sheet.tsx`, `apps/web/src/hooks/useMediaQuery.ts`

**Interfaces:**
- Produces:
  - `fieldLineClass(status?: FieldStatus): string`
  - `statusFor(message?: string): { status: FieldStatus | undefined; message: string | undefined }`
  - `Field` prop `hideLabel?: boolean`
  - `TextArea` (forwardRef; props `label`, `message?`, `status?`, `head?`, plus textarea attrs)
  - `Select<V>({ label, value, options: readonly {value: V; label: string}[], onChange(v: V) })`
  - `SearchInput({ value, onChange(value: string), 'aria-label', ...inputAttrs })`
  - `Sheet({ open, onClose, title, children?, actions? })`
  - `useMediaQuery(query: string): boolean`
  - `formatShortDate(value: string | Date): string`
  - `openTelegramLink(url: string): boolean`

- [ ] **Step 1: Add the tokens**

In `apps/web/src/styles/theme.css`, inside `@theme`, right after the `--color-gold-soft` line:

```css

  /* Rejected states: the palette's own ember-adjacent orange, never a borrowed red */
  --color-error: #e9976a;
  --color-error-line: #b2532a;
```

In `apps/web/src/styles/base.css`, right after the `--safe-b: env(safe-area-inset-bottom, 0px);` line:

```css
  /* Telegram fullscreen reports its own chrome as CSS vars; the OS inset covers the web. */
  --safe-t: max(
    env(safe-area-inset-top, 0px),
    calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px))
  );
```

- [ ] **Step 2: Replace the hex literals with tokens**

```bash
cd apps/web/src
grep -rl "E9976A\|B2532A" . | xargs sed -i '' \
  -e 's/text-\[#E9976A\]/text-error/g' \
  -e 's/border-b-\[color:#B2532A\]/border-b-error-line/g'
grep -rn "E9976A\|B2532A" .
```

Expected: the last `grep` prints nothing. If a line remains, it uses another form, for example `color: #E9976A` in a style or `text-[#e9976a]`. Replace those by hand with `text-error` or `var(--color-error)`.

- [ ] **Step 3: Extend `Field`**

In `apps/web/src/components/ui/Field.tsx`:

1. Add to `FieldProps` after `head?: ReactNode;`:
```ts
  /** Keeps the label for screen readers only — for rows that already show it, like the date timeline. */
  hideLabel?: boolean;
```
2. Add `hideLabel = false` to the destructured props: `{ id, label, message, status, shakeToken = 0, head, hideLabel = false, className = '', ...inputProps }`.
3. In both `<label htmlFor={fieldId} className="type-label">` occurrences, change `className` to `` className={hideLabel ? 'sr-only' : 'type-label'} ``.
4. Below the `MSG` constant, add:
```ts
/** The ruled underline, shared with TextArea and Select so every input reads as one family. */
export function fieldLineClass(status?: FieldStatus): string {
  return INPUT_BORDER[status ?? 'neutral'];
}

/** Server or schema message → the two props every input takes; blank means neutral. */
export function statusFor(message?: string): { status: FieldStatus | undefined; message: string | undefined } {
  return { status: message ? 'bad' : undefined, message };
}
```

- [ ] **Step 4: Create `TextArea`**

`apps/web/src/components/ui/TextArea.tsx`:

```tsx
import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { fieldLineClass, type FieldStatus } from './Field';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id?: string;
  label: string;
  message?: string;
  status?: FieldStatus;
  /** Right side of the label row — a character counter, usually. */
  head?: ReactNode;
  className?: string;
}

/** `Field`'s multi-line sibling: same label, underline and message slot. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { id, label, message, status, head, className = '', ...props },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const msgId = `${fieldId}-msg`;

  return (
    <div className={`grid gap-[0.4rem] ${className}`}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={fieldId} className="type-label">
          {label}
        </label>
        {head}
      </div>
      <textarea
        {...props}
        ref={ref}
        id={fieldId}
        aria-describedby={msgId}
        aria-invalid={status === 'bad' || undefined}
        className={`w-full resize-y border-0 border-b bg-transparent px-[0.15rem] py-2 text-base text-paper placeholder:text-taupe focus:outline-none ${fieldLineClass(status)}`}
      />
      <p
        id={msgId}
        role="status"
        className={`m-0 min-h-[1.15rem] text-sm leading-[1.35] ${status === 'bad' ? 'text-error' : 'text-taupe'}`}
      >
        {message}
      </p>
    </div>
  );
});
```

- [ ] **Step 5: Create `Select`**

`apps/web/src/components/ui/Select.tsx`:

```tsx
import { useId, type SelectHTMLAttributes } from 'react';
import { fieldLineClass } from './Field';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

interface SelectProps<V extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'value' | 'onChange'> {
  label: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  className?: string;
}

/** A native select in `Field`'s clothes; native keeps the phone's own picker. */
export function Select<V extends string>({ label, value, options, onChange, className = '', ...props }: SelectProps<V>) {
  const id = useId();

  return (
    <div className={`grid gap-[0.4rem] ${className}`}>
      <label htmlFor={id} className="type-label">
        {label}
      </label>
      <select
        {...props}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as V)}
        className={`h-[3.25rem] w-full border-0 border-b bg-transparent px-1 text-base text-paper focus:outline-none ${fieldLineClass()}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-ink text-paper">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 6: Create `SearchInput`**

`apps/web/src/components/ui/SearchInput.tsx`:

```tsx
import type { InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { fieldLineClass } from './Field';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
}

export function SearchInput({ value, onChange, className = '', ...props }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-taupe"
      />
      <input
        {...props}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-11 w-full border-0 border-b bg-transparent pl-7 pr-1 text-base text-paper placeholder:text-taupe focus:outline-none ${fieldLineClass()}`}
      />
    </div>
  );
}
```

- [ ] **Step 7: Create `Sheet` and its styles**

`apps/web/src/components/ui/Sheet.tsx`:

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** Buttons, primary last — they stack primary-on-top on phones. */
  actions?: ReactNode;
}

/**
 * Native `<dialog>`: focus trap, Esc and an inert page behind it come from the
 * browser. A bottom sheet on phones, a centred dialog from `sm` up (`.sheet`).
 */
export function Sheet({ open, onClose, title, children, actions }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // The inner div fills the dialog, so a click landing on the dialog itself is the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="sheet"
    >
      <div className="flex flex-col gap-4 p-5 pb-[calc(1.25rem+var(--safe-b))]">
        <h2 id={titleId} className="type-display m-0 text-xl text-paper">
          {title}
        </h2>
        {children}
        {actions && <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>}
      </div>
    </dialog>
  );
}
```

Append to the end of `apps/web/src/styles/shell.css`:

```css
/* ── Sheet ─────────────────────────────────────────────────────────
   `components/ui/Sheet.tsx`. Bottom sheet on phones, dialog from 640px. */
.sheet {
  margin: auto auto 0;
  width: 100%;
  max-width: 100%;
  max-height: 85dvh;
  overflow-y: auto;
  padding: 0;
  border: 1px solid var(--rule);
  border-bottom: 0;
  border-radius: 14px 14px 0 0;
  background: var(--color-ash);
  color: var(--color-paper);
}

.sheet::backdrop {
  background: rgb(10 7 5 / 0.6);
  backdrop-filter: blur(4px);
}

.sheet[open] {
  animation: sheet-up 260ms var(--ease-out-quest);
}

@keyframes sheet-up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
}

@media (min-width: 640px) {
  .sheet {
    margin: auto;
    max-width: 28rem;
    border-bottom: 1px solid var(--rule);
    border-radius: var(--radius-box);
  }
}
```

- [ ] **Step 8: `useMediaQuery`, `formatShortDate` and `openTelegramLink`**

`apps/web/src/hooks/useMediaQuery.ts`:

```ts
import { useCallback, useSyncExternalStore } from 'react';

/** Live `matchMedia` answer; false during SSR-less first paint never happens here, but the server snapshot must exist. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
```

In `apps/web/src/lib/format.ts`, after the `COUNT` constant:

```ts
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
```

and after `formatLongDate`:

```ts
/** "5 Apr" — a date inside a one-line summary, where year and time are noise. */
export function formatShortDate(value: string | Date): string {
  return SHORT_DATE.format(typeof value === 'string' ? new Date(value) : value);
}
```

In `apps/web/src/lib/telegram.ts`, add to the `TelegramWebApp` interface after `openLink?`:

```ts
  openTelegramLink?: (url: string) => void;
```

and append at the end of the file:

```ts
/** A t.me link opened from inside the sheet stays inside Telegram; `false` means use a plain link. */
export function openTelegramLink(url: string): boolean {
  if (!isInsideTelegram()) return false;

  const open = getTelegramWebApp()?.openTelegramLink;
  if (!open) return false;

  try {
    open(url);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`
Expected: every package passes.

- [ ] **Step 10: Manual check**

Start the mock dev server. Open `/me` (registration form) and the quest editor, clear a required field, and confirm the error text and underline are still orange. Nothing else changes visually yet.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/styles apps/web/src/components/ui apps/web/src/hooks/useMediaQuery.ts \
  apps/web/src/lib/format.ts apps/web/src/lib/telegram.ts apps/web/src/features apps/web/src/lib/auth
git commit -m "feat(web): error tokens, top safe area, TextArea/Select/SearchInput/Sheet primitives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Admin shell — header, query wrapper, phase labels, back-button rule

**Files:**
- Modify: `packages/shared/src/schemas/admin.ts`
- Modify: `apps/web/src/layouts/AdminLayout.tsx`
- Create: `apps/web/src/features/admin/phase.ts`, `apps/web/src/features/admin/components/AdminPageHeader.tsx`, `apps/web/src/features/admin/components/AdminQuery.tsx`
- Modify: `apps/web/src/features/admin/ResultsInspectionPage.tsx`, `ParticipantsPage.tsx`, `QuestEditorPage.tsx`, `DashboardPage.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `PHASE_LABEL: Record<QuestPhase, string>`
  - `interface Milestone { label: string; at: string }`
  - `nextMilestone(quest: Quest, now: Date): Milestone | null`
  - `AdminPageHeader({ eyebrow: string; title: string; actions?: ReactNode })`
  - `AdminQuery<T>({ query: QueryLike<T>; loadingLabel: string; notFound?: (error: ApiRequestError) => ReactNode; children: (data: T) => ReactNode })`, where `QueryLike<T> = { data: T | undefined; error: unknown; isPending: boolean; refetch: () => unknown }`

- [ ] **Step 1: Type the stats phase**

In `packages/shared/src/schemas/admin.ts`, add `import type { QuestPhase } from '../constants/quest.js';` at the top. In `AdminStats`, change `phase: string;` to `phase: QuestPhase;`.

- [ ] **Step 2: Create `phase.ts`**

`apps/web/src/features/admin/phase.ts`:

```ts
import type { Quest, QuestPhase } from '@bookquest/shared';

export const PHASE_LABEL: Record<QuestPhase, string> = {
  upcoming: 'Upcoming',
  reading: 'Reading',
  quiz: 'Quiz open',
  finished: 'Finished'
};

export interface Milestone {
  label: string;
  at: string;
}

/** The next date the quest is waiting on. `null` once results are out — nothing left to count to. */
export function nextMilestone(quest: Quest, now: Date): Milestone | null {
  const before = (iso: string) => now.getTime() < Date.parse(iso);

  switch (quest.phase) {
    case 'upcoming':
      return { label: 'Opens', at: quest.opensAt };
    case 'reading':
      // The phase stays "reading" between the deadline and the quiz opening.
      return before(quest.readingDeadline)
        ? { label: 'Reading ends', at: quest.readingDeadline }
        : { label: 'Quiz opens', at: quest.quizOpensAt };
    case 'quiz':
      return { label: 'Quiz closes', at: quest.quizClosesAt };
    case 'finished':
      return before(quest.resultsAt) ? { label: 'Results published', at: quest.resultsAt } : null;
  }
}
```

- [ ] **Step 3: Create `AdminPageHeader`**

`apps/web/src/features/admin/components/AdminPageHeader.tsx`:

```tsx
import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
}

export function AdminPageHeader({ eyebrow, title, actions }: AdminPageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="type-label m-0">{eyebrow}</p>
        <h1 className="type-display m-0 break-words text-3xl text-paper">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
```

- [ ] **Step 4: Create `AdminQuery`**

`apps/web/src/features/admin/components/AdminQuery.tsx`:

```tsx
import type { ReactNode } from 'react';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { isNotFound, type ApiRequestError } from '@/lib/api/client';
import { ForbiddenState, isForbidden } from './ForbiddenState';

/** Structural, so plain and infinite queries both fit. */
interface QueryLike<T> {
  data: T | undefined;
  error: unknown;
  isPending: boolean;
  refetch: () => unknown;
}

interface AdminQueryProps<T> {
  query: QueryLike<T>;
  loadingLabel: string;
  /** Omit and a 404 renders as an ordinary error. */
  notFound?: (error: ApiRequestError) => ReactNode;
  children: (data: T) => ReactNode;
}

/** The loading → 403 → 404 → error ladder every admin screen used to spell out itself. */
export function AdminQuery<T>({ query, loadingLabel, notFound, children }: AdminQueryProps<T>) {
  // Data first: a failed background refetch keeps the last good screen instead of blanking it.
  if (query.data !== undefined) return <>{children(query.data)}</>;

  if (query.error) {
    if (isForbidden(query.error)) return <ForbiddenState error={query.error} />;
    if (notFound && isNotFound(query.error)) return <>{notFound(query.error)}</>;
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} className="flex-1" />;
  }

  return <LoadingState label={loadingLabel} />;
}
```

If `isNotFound` isn't exported as a type guard for `ApiRequestError`, check `apps/web/src/lib/api/client.ts:46`. It is `error is ApiRequestError`, so this compiles.

- [ ] **Step 5: Fix the header's top inset**

In `apps/web/src/layouts/AdminLayout.tsx`, in `AdminNav`'s `<header>`, change `pt-[calc(1rem+var(--safe-b))]` to `pt-[calc(1rem+var(--safe-t))]`.

- [ ] **Step 6: Apply the back-button rule and the new pieces**

1. `ParticipantsPage.tsx`: delete `useTelegramBackButton('/admin');`, its import, and the doc sentence "A child of the dashboard, not a tab root, so it does get the back button." Replace the `<header>…</header>` block with `<AdminPageHeader eyebrow="Participants" title="The roster" />` and import it from `./components/AdminPageHeader`.
2. `QuestEditorPage.tsx`: delete `useTelegramBackButton('/admin');`, its import, and the doc sentence "A child of the dashboard, so it gets the back button." (This file is moved and rewritten in Tasks 3–4.)
3. `DashboardPage.tsx`: in the doc comment, replace the sentence starting "so it gets no Telegram back button; the three screens under it do" with "no admin tab root shows the Telegram back button — they are siblings, not children." Change `<span className="text-paper-dim">{stats.data.phase}</span>` to `<span className="text-paper-dim">{PHASE_LABEL[stats.data.phase]}</span>` and add `import { PHASE_LABEL } from './phase';`.
4. Replace `ResultsInspectionPage.tsx` entirely:

```tsx
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Rule } from '@/components/ui/Rule';
import { ResultsPodium } from '@/components/ResultsPodium';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { formatLongDate } from '@/lib/format';
import { useAdminResultsInspection } from './api/useAdminResultsInspection';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';

/**
 * `/admin/results` — read-only, and the same public `GET /quests/current/results`
 * the participant screen reads (see `useAdminResultsInspection`).
 */
export function ResultsInspectionPage() {
  const results = useAdminResultsInspection();

  return (
    <AdminQuery
      query={results}
      loadingLabel="Tallying the scores…"
      notFound={(error) => (
        <EmptyState title={error.message} body="Check the quest editor for the results date." className="flex-1" />
      )}
    >
      {({ podium, leaderboard, publishedAt }) => (
        <AdminScreen className="max-w-3xl">
          <AdminPageHeader eyebrow="Results" title={`Published ${formatLongDate(publishedAt)}`} />

          {leaderboard.length === 0 ? (
            <EmptyState
              title="No one finished the quiz"
              titleAs="h2"
              body="The results are in, but nobody submitted an attempt this year."
              className="flex-1"
            />
          ) : (
            <>
              <ResultsPodium entries={podium} />
              <section className="flex flex-col gap-1">
                <p className="type-label">Full leaderboard</p>
                <Rule />
                <ol className="flex flex-col">
                  {leaderboard.map((entry) => (
                    <LeaderboardRow key={entry.number} entry={entry} />
                  ))}
                </ol>
              </section>
            </>
          )}
        </AdminScreen>
      )}
    </AdminQuery>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. The API's `getStats` already returns `resolvePhase(quest)`, which is a `QuestPhase`, so it still compiles.

- [ ] **Step 8: Manual check**

At 390px:
- The Dashboard shows "Phase: Reading" (capitalised), not `reading`.
- Results loads, or shows its empty state.
- `grep -rn useTelegramBackButton apps/web/src/features/admin` prints nothing: no tab root shows Telegram's back button.
- In DevTools, set the device to iPhone 14 Pro and confirm the header isn't pushed down by an extra ~34px.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/schemas/admin.ts apps/web/src/layouts/AdminLayout.tsx apps/web/src/features/admin
git commit -m "feat(web): admin page header, query wrapper, phase labels; drop back button on tab roots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase B · Quest editor

### Task 3: Move the editor into `quest/` and add the form model

**Files:**
- Move: `features/admin/questForm.ts` → `features/admin/quest/questForm.ts`; `QuestEditorPage.tsx` → `quest/QuestEditorPage.tsx`; `components/{BookFieldsSection,CoverPicker,ResourceListEditor,PrizeFieldsSection,QuestDateFieldsSection,QuizMetaFieldsSection}.tsx` → `quest/components/`
- Modify: `apps/web/src/app/router.tsx`, `apps/web/package.json`
- Create: `apps/web/src/features/admin/dates.ts`, `quest/questFormSchema.ts`, `quest/serverErrors.ts`, `quest/changes.ts`, `quest/summaries.ts`

**Interfaces:**
- Produces (`quest/questForm.ts`, newly exported):
  - `trimmedOrNull(value: string): string | null`
  - `toResources(drafts: ResourceDraft[]): BookResource[]`
  - `toOptionalCount(value: string): number | null`
- Produces (`features/admin/dates.ts`):
  - `DATE_LABEL: Record<QuestDateField, string>`
  - `GAP_LABEL: Partial<Record<QuestDateField, string>>`
  - `type DateInputs = Record<QuestDateField, string>`
  - `parseLocal(value: string): Date | null`
  - `formatGap(from: Date | null, to: Date | null): string | null`
  - `questDates(quest: Quest): Record<QuestDateField, Date>`
- Produces (`quest/`):
  - `questFormSchema` (Zod, `satisfies z.ZodType<QuestFormState>`)
  - `toFormPath(serverKey: string): string`
  - `applyServerErrors(error: ApiRequestError, setError: UseFormSetError<QuestFormState>): string | null`
  - `type EditorSectionId = 'book' | 'resources' | 'prizes' | 'dates' | 'quiz'`
  - `interface ChangeSummary { count: number; sections: ReadonlySet<EditorSectionId> }`
  - `NO_CHANGES: ChangeSummary`
  - `summarizeChanges(patch: UpdateQuestPayload | null): ChangeSummary`
  - `sectionsWithErrors(errors: FieldErrors<QuestFormState>): ReadonlySet<EditorSectionId>`
  - `countErrors(errors: object): number`
  - `sectionSummaries(values: QuestFormState): Record<EditorSectionId, string>`

- [ ] **Step 1: Branch and install**

```bash
git switch -c feat/admin-redesign
pnpm --filter @bookquest/web add react-hook-form@^7 @hookform/resolvers@^5 zod@^4.5.4
```

Expected: all three appear under `dependencies` in `apps/web/package.json`. `@hookform/resolvers@5` supports Zod 4 through `@hookform/resolvers/zod`.

- [ ] **Step 2: Move the files**

```bash
cd apps/web/src/features/admin
mkdir -p quest/components
git mv questForm.ts quest/questForm.ts
git mv QuestEditorPage.tsx quest/QuestEditorPage.tsx
for f in BookFieldsSection CoverPicker ResourceListEditor PrizeFieldsSection QuestDateFieldsSection QuizMetaFieldsSection; do
  git mv components/$f.tsx quest/components/$f.tsx
done
```

Then fix the imports:
- `quest/QuestEditorPage.tsx`:
  - `./api/useUpdateQuest` → `../api/useUpdateQuest`
  - `./components/ForbiddenState` → `../components/ForbiddenState`
  - `./components/BookFieldsSection` (and the other moved sections) → `./components/…` (unchanged)
  - `./questForm` stays.
- `quest/components/CoverPicker.tsx`: `../api/useUploadCover` → `../../api/useUploadCover`.
- In `apps/web/src/app/router.tsx`: `@/features/admin/QuestEditorPage` → `@/features/admin/quest/QuestEditorPage`.

Run `pnpm typecheck`. Expected: PASS (only paths changed).

- [ ] **Step 3: Export the shared value helpers from `questForm.ts`**

In `quest/questForm.ts`:

1. Change `function trimmedOrNull` to `export function trimmedOrNull`.
2. Add after it:

```ts
/** Trimmed rows, the exact shape the API stores — used by both the edit diff and the create payload. */
export function toResources(drafts: ResourceDraft[]): BookResource[] {
  return drafts.map((resource) => ({
    label: resource.label.trim(),
    url: resource.url.trim(),
    kind: resource.kind
  }));
}

/** Blank → `null` ("undecided"); anything else is already a validated whole number. */
export function toOptionalCount(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}
```

3. In `buildQuestPatch`, replace the inline `resources` mapping with `const resources = toResources(form.book.resources);`. Replace the two `quizQuestionCount` / `quizDurationMinutes` ternaries with `toOptionalCount(form.quizQuestionCount)` and `toOptionalCount(form.quizDurationMinutes)`.

- [ ] **Step 4: Create `features/admin/dates.ts`**

```ts
import { QUEST_DATE_FIELDS, type Quest, type QuestDateField } from '@bookquest/shared';

export const DATE_LABEL: Record<QuestDateField, string> = {
  opensAt: 'Opens',
  readingDeadline: 'Reading deadline',
  quizOpensAt: 'Quiz opens',
  quizClosesAt: 'Quiz closes',
  resultsAt: 'Results published'
};

/** The stretch that *follows* each date; the last one has none. */
export const GAP_LABEL: Partial<Record<QuestDateField, string>> = {
  opensAt: 'Reading',
  readingDeadline: 'Break',
  quizOpensAt: 'Quiz',
  quizClosesAt: 'Until results'
};

export type DateInputs = Record<QuestDateField, string>;

/** `datetime-local` text → Date, or null for blank or half-typed input (Intl throws on Invalid Date). */
export function parseLocal(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatGap(from: Date | null, to: Date | null): string | null {
  if (!from || !to) return null;
  const hours = (to.getTime() - from.getTime()) / 3_600_000;
  if (hours < 0) return null;
  if (hours === 0) return 'no gap';
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function questDates(quest: Quest): Record<QuestDateField, Date> {
  return Object.fromEntries(QUEST_DATE_FIELDS.map((field) => [field, new Date(quest[field])])) as Record<
    QuestDateField,
    Date
  >;
}
```

- [ ] **Step 5: Create `quest/questFormSchema.ts`**

```ts
import { z } from 'zod';
import { BOOK_RESOURCE_KINDS, findQuestDateIssues } from '@bookquest/shared';
import { parseLocal } from '../dates';
import { formDates, isValidResourceUrl, type QuestFormState } from './questForm';

const required = (message: string, max: number, tooLong: string) =>
  z
    .string()
    .refine((value) => value.trim() !== '', message)
    .refine((value) => value.trim().length <= max, tooLong);

const wholeNumber = (value: string, max: number) =>
  /^\d+$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= max;

const optionalWhole = (max: number, message: string) =>
  z.string().refine((value) => value.trim() === '' || wholeNumber(value, max), message);

const prize = z.string().refine((value) => value.trim().length <= 200, 'Keep it under 200 characters.');
const date = z.string().refine((value) => parseLocal(value) !== null, 'Pick a date and time.');

/**
 * The client mirror of the API's limits, over the form's string values. The
 * server stays the authority; this only makes the answer instant.
 */
export const questFormSchema = z
  .object({
    book: z.object({
      title: required('Give the book a title.', 200, 'Keep the title under 200 characters.'),
      author: required('Who wrote it?', 200, 'Keep the author under 200 characters.'),
      pages: z.string().refine((value) => wholeNumber(value, 20_000), 'Whole pages, 1 to 20,000.'),
      coverUrl: z.string(),
      description: z.string().refine((value) => value.trim().length <= 4000, 'Keep it under 4,000 characters.'),
      resources: z
        .array(
          z.object({
            label: required('Name this link.', 80, 'Keep the name under 80 characters.'),
            url: z.string().refine((value) => isValidResourceUrl(value.trim()), 'That doesn’t look like a full URL.'),
            kind: z.enum(BOOK_RESOURCE_KINDS)
          })
        )
        .max(12)
    }),
    prizes: z.object({ first: prize, second: prize, third: prize }),
    dates: z.object({
      opensAt: date,
      readingDeadline: date,
      quizOpensAt: date,
      quizClosesAt: date,
      resultsAt: date
    }),
    quizQuestionCount: optionalWhole(200, 'A whole number from 1 to 200, or blank.'),
    quizDurationMinutes: optionalWhole(600, 'Whole minutes up to 600, or blank.')
  })
  .superRefine((values, ctx) => {
    // Ordering only means something once all five parse; "Pick a date" covers the rest.
    if (Object.values(values.dates).some((value) => parseLocal(value) === null)) return;
    const issues = findQuestDateIssues(formDates(values));
    for (const [field, message] of Object.entries(issues ?? {})) {
      ctx.addIssue({ code: 'custom', path: ['dates', field], message });
    }
  }) satisfies z.ZodType<QuestFormState>;
```

- [ ] **Step 6: Create `quest/serverErrors.ts`**

```ts
import { QUEST_DATE_FIELDS } from '@bookquest/shared';
import type { FieldPath, UseFormSetError } from 'react-hook-form';
import type { ApiRequestError } from '@/lib/api/client';
import type { QuestFormState } from './questForm';

const DATE_KEYS = new Set<string>(QUEST_DATE_FIELDS);
const FORM_ROOTS = new Set(['book', 'prizes', 'dates', 'quizQuestionCount', 'quizDurationMinutes']);

/** The API keys dates at the top level; the form nests them under `dates`. */
export function toFormPath(serverKey: string): string {
  return DATE_KEYS.has(serverKey) ? `dates.${serverKey}` : serverKey;
}

/**
 * Drops `error.fields` onto matching inputs (focusing the first). Returns the
 * message to show at form level: the error itself when it names no field, or
 * the first message for a key the form has no input for (`edition`, `year`).
 */
export function applyServerErrors(
  error: ApiRequestError,
  setError: UseFormSetError<QuestFormState>
): string | null {
  const entries = Object.entries(error.fields);
  if (entries.length === 0) return error.message;

  let formMessage: string | null = null;
  let focused = false;

  for (const [key, message] of entries) {
    const path = toFormPath(key);
    if (!FORM_ROOTS.has(path.split('.')[0] ?? '')) {
      formMessage ??= message;
      continue;
    }
    setError(path as FieldPath<QuestFormState>, { type: 'server', message }, { shouldFocus: !focused });
    focused = true;
  }

  return formMessage;
}
```

- [ ] **Step 7: Create `quest/changes.ts`**

```ts
import { QUEST_DATE_FIELDS, type UpdateQuestPayload } from '@bookquest/shared';
import type { FieldErrors } from 'react-hook-form';
import type { QuestFormState } from './questForm';

export type EditorSectionId = 'book' | 'resources' | 'prizes' | 'dates' | 'quiz';

export interface ChangeSummary {
  count: number;
  sections: ReadonlySet<EditorSectionId>;
}

export const NO_CHANGES: ChangeSummary = { count: 0, sections: new Set() };

/**
 * Counted from the patch, not from raw input, so "3 changes" is exactly what
 * Save will send — a trailing space doesn't count. The resource list is one change.
 */
export function summarizeChanges(patch: UpdateQuestPayload | null): ChangeSummary {
  if (!patch) return NO_CHANGES;

  const sections = new Set<EditorSectionId>();
  let count = 0;
  const tally = (section: EditorSectionId, n: number) => {
    if (n === 0) return;
    count += n;
    sections.add(section);
  };

  const { resources, ...book } = patch.book ?? {};
  tally('book', Object.keys(book).length);
  tally('resources', resources ? 1 : 0);
  tally('prizes', Object.keys(patch.prizes ?? {}).length);
  tally('dates', QUEST_DATE_FIELDS.filter((field) => patch[field] !== undefined).length);
  tally(
    'quiz',
    (['quizQuestionCount', 'quizDurationMinutes'] as const).filter((key) => patch[key] !== undefined).length
  );

  return { count, sections };
}

export function sectionsWithErrors(errors: FieldErrors<QuestFormState>): ReadonlySet<EditorSectionId> {
  const sections = new Set<EditorSectionId>();
  const { resources, ...book } = errors.book ?? {};

  if (Object.keys(book).length > 0) sections.add('book');
  if (resources) sections.add('resources');
  if (errors.prizes) sections.add('prizes');
  if (errors.dates) sections.add('dates');
  if (errors.quizQuestionCount || errors.quizDurationMinutes) sections.add('quiz');
  return sections;
}

/** Leaf errors only. `ref` is skipped — it's a DOM node, and walking one never ends well. */
export function countErrors(errors: object): number {
  return Object.entries(errors).reduce<number>((total, [key, value]) => {
    if (key === 'ref' || !value || typeof value !== 'object') return total;
    if ('message' in value && typeof value.message === 'string') return total + 1;
    return total + countErrors(value);
  }, 0);
}
```

- [ ] **Step 8: Create `quest/summaries.ts`**

```ts
import { formatShortDate } from '@/lib/format';
import { parseLocal } from '../dates';
import type { EditorSectionId } from './changes';
import type { QuestFormState } from './questForm';

const short = (value: string) => {
  const date = parseLocal(value);
  return date ? formatShortDate(date) : '—';
};

/** One line per collapsed section header, from the current (unsaved) values. */
export function sectionSummaries(values: QuestFormState): Record<EditorSectionId, string> {
  const { book, prizes, dates } = values;
  const count = values.quizQuestionCount.trim();
  const minutes = values.quizDurationMinutes.trim();

  return {
    book: [book.title.trim() || 'Untitled', book.pages.trim() && `${book.pages.trim()} pp`, book.coverUrl ? 'cover' : 'drawn cover']
      .filter(Boolean)
      .join(' · '),
    resources:
      book.resources.length === 0
        ? 'None yet'
        : book.resources.map((resource) => resource.label.trim() || 'Untitled').join(' · '),
    prizes:
      [prizes.first, prizes.second, prizes.third]
        .map((prize) => prize.trim())
        .filter(Boolean)
        .join(' · ') || 'None set',
    dates: `Opens ${short(dates.opensAt)} · Quiz ${short(dates.quizOpensAt)}–${short(dates.quizClosesAt)}`,
    quiz:
      !count && !minutes
        ? 'Undecided'
        : [count && `${count} questions`, minutes && `${minutes} min`].filter(Boolean).join(' · ')
  };
}
```

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. If `satisfies z.ZodType<QuestFormState>` fails because `kind` widens, change the `resources` element to `z.object({...}) as z.ZodType<ResourceDraft>`. Better: check that `BOOK_RESOURCE_KINDS` is `as const` in shared. It is (`constants/quest.ts`), so `z.enum` yields the literal union and this should pass unchanged.

- [ ] **Step 10: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/app/router.tsx apps/web/src/features/admin
git commit -m "refactor(web): move quest editor into quest/, add form schema, change and summary helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Rebuild the editor on react-hook-form, with sections, save bar and leave guard

**Files:**
- Create: `apps/web/src/hooks/useUnsavedChangesGuard.ts`, `apps/web/src/hooks/useSaveShortcut.ts`
- Create: `features/admin/components/SaveBar.tsx`, `features/admin/components/UnsavedChangesSheet.tsx`
- Create: `quest/components/EditorSection.tsx`, `quest/components/QuestFormFields.tsx`
- Rewrite: `quest/QuestEditorPage.tsx`, `quest/components/BookFieldsSection.tsx`, `PrizeFieldsSection.tsx`, `QuizMetaFieldsSection.tsx`, `QuestDateFieldsSection.tsx` (interim, replaced in Task 5), `ResourceListEditor.tsx` (interim, replaced in Task 6)
- Modify: `apps/web/src/styles/shell.css`

**Interfaces:**
- Consumes: everything Task 3 produces; `Sheet`, `TextArea`, `statusFor`, `useMediaQuery` from Task 1; `AdminQuery`, `AdminPageHeader` from Task 2.
- Produces:
  - `useUnsavedChangesGuard(isDirty: boolean): { blocker: Blocker; bypass: () => void }`
  - `useSaveShortcut(onSave: (() => void) | null): void`
  - `SaveBar({ visible, summary, tone?, submitLabel, busyLabel, isBusy, disabled, formId, onDiscard, discardLabel?, children? })`
  - `UnsavedChangesSheet({ blocker: Blocker })`
  - `EditorSection({ title, summary, isDirty, hasError, defaultOpen, children })`
  - `QuestFormFields({ changes: ChangeSummary; savedDates: DateInputs | null; onCoverUploadingChange(uploading: boolean): void })`. `savedDates` is unused until Task 5; accept it now so the signature is final.
  - `QUEST_FORM_ID = 'quest-form'` (exported from `quest/QuestEditorPage.tsx`)

- [ ] **Step 1: Leave guard and save shortcut**

`apps/web/src/hooks/useUnsavedChangesGuard.ts`:

```ts
import { useCallback, useEffect, useRef } from 'react';
import { useBlocker, type Blocker, type BlockerFunction } from 'react-router';

/**
 * Holds in-app navigation while `isDirty`, and asks the browser to confirm a
 * reload or tab close. Telegram's own close confirmation is already on
 * globally (`initTelegram`). `bypass()` is for "saved, now leaving": it's a
 * ref, so it takes effect before the next render can clear `isDirty`.
 */
export function useUnsavedChangesGuard(isDirty: boolean): { blocker: Blocker; bypass: () => void } {
  const bypassed = useRef(false);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      isDirty && !bypassed.current && currentLocation.pathname !== nextLocation.pathname,
    [isDirty]
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const bypass = useCallback(() => {
    bypassed.current = true;
  }, []);

  return { blocker, bypass };
}
```

Check that `useBlocker`, `Blocker` and `BlockerFunction` are exported by the installed router: `grep -o "useBlocker\|BlockerFunction" apps/web/node_modules/react-router/dist/production/index.d.mts | sort -u`. The file name can vary by version; `ls apps/web/node_modules/react-router/dist` shows it. Expected: both names print.

`apps/web/src/hooks/useSaveShortcut.ts`:

```ts
import { useEffect, useRef } from 'react';

/** ⌘S / Ctrl+S runs `onSave`; `null` still swallows the browser's own "save page" dialog. */
export function useSaveShortcut(onSave: (() => void) | null): void {
  const latest = useRef(onSave);

  useEffect(() => {
    latest.current = onSave;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      latest.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
```

- [ ] **Step 2: `SaveBar`, its styles and `UnsavedChangesSheet`**

`features/admin/components/SaveBar.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface SaveBarProps {
  visible: boolean;
  summary: string;
  tone?: 'neutral' | 'bad';
  submitLabel: string;
  busyLabel: string;
  isBusy: boolean;
  disabled: boolean;
  /** The bar sits outside the <form>, so Save submits it by id. */
  formId: string;
  onDiscard: () => void;
  discardLabel?: string;
  children?: ReactNode;
}

/** Pinned above the tab bar and present only while there is something to save. */
export function SaveBar({
  visible,
  summary,
  tone = 'neutral',
  submitLabel,
  busyLabel,
  isBusy,
  disabled,
  formId,
  onDiscard,
  discardLabel = 'Discard',
  children
}: SaveBarProps) {
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      aria-hidden={!visible}
      inert={!visible}
      className={`admin-savebar ${visible ? 'is-on' : ''}`}
    >
      <p aria-live="polite" className={`m-0 flex-1 text-sm ${tone === 'bad' ? 'text-error' : 'text-paper-dim'}`}>
        {summary}
      </p>
      {children}
      <Button type="button" variant="quiet" onClick={onDiscard} className="min-h-11 px-3">
        {discardLabel}
      </Button>
      <Button type="submit" form={formId} disabled={disabled} className="min-h-11 px-5">
        {isBusy ? busyLabel : submitLabel}
      </Button>
    </div>
  );
}
```

Append to `apps/web/src/styles/shell.css`:

```css
/* ── Admin save bar ────────────────────────────────────────────────
   `features/admin/components/SaveBar.tsx`. Below 900px the tab bar sits at the
   viewport bottom, so the bar docks right on top of it; above, both float. */
.admin-savebar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--tabbar-h) + var(--safe-b));
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--rule);
  background: rgb(20 16 12 / 0.94);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  opacity: 0;
  transform: translateY(0.75rem);
  pointer-events: none;
  transition:
    opacity 180ms linear,
    transform 220ms var(--ease-out-quest);
}

.admin-savebar.is-on {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

@media (min-width: 900px) {
  .admin-savebar {
    left: 50%;
    right: auto;
    width: min(44rem, calc(100% - 3rem));
    bottom: calc(var(--tabbar-h) + 2.2rem);
    border: 1px solid var(--rule);
    border-radius: var(--radius-box);
    transform: translate(-50%, 0.75rem);
  }

  .admin-savebar.is-on {
    transform: translate(-50%, 0);
  }
}
```

`features/admin/components/UnsavedChangesSheet.tsx`:

```tsx
import type { Blocker } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

export function UnsavedChangesSheet({ blocker }: { blocker: Blocker }) {
  return (
    <Sheet
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title="Discard your changes?"
      actions={
        <>
          <Button type="button" variant="quiet" onClick={() => blocker.reset?.()}>
            Keep editing
          </Button>
          <Button type="button" onClick={() => blocker.proceed?.()}>
            Discard
          </Button>
        </>
      }
    >
      <p className="m-0 text-taupe">These edits aren't saved yet. Leaving now throws them away.</p>
    </Sheet>
  );
}
```

- [ ] **Step 3: `EditorSection`**

`quest/components/EditorSection.tsx`:

```tsx
import { useId, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';

interface EditorSectionProps {
  title: string;
  summary: string;
  isDirty: boolean;
  hasError: boolean;
  defaultOpen: boolean;
  children: ReactNode;
}

/**
 * A collapsible group whose header says what's inside, so a one-field fix is
 * one tap away. The body stays mounted (`hidden`), so collapsing never
 * unregisters fields, and an error keeps the section open.
 */
export function EditorSection({ title, summary, isDirty, hasError, defaultOpen, children }: EditorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = open || hasError;
  const bodyId = useId();

  return (
    <section className="border-b border-[color:var(--rule)]">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setOpen(!isOpen)}
        className="flex min-h-14 w-full items-center gap-3 py-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-label">{title}</span>
          <span className="truncate text-sm text-paper-dim">{summary}</span>
        </span>
        {hasError ? (
          <AlertTriangle aria-label="Has errors" className="h-4 w-4 shrink-0 text-error" />
        ) : isDirty ? (
          <span aria-label="Unsaved changes" className="h-2 w-2 shrink-0 rounded-full bg-ember" />
        ) : null}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-taupe transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div id={bodyId} hidden={!isOpen} className="flex flex-col gap-4 pb-6">
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Convert the section components to `useFormContext`**

`quest/components/BookFieldsSection.tsx`:

```tsx
import { Controller, useFormContext } from 'react-hook-form';
import { Field, statusFor } from '@/components/ui/Field';
import { TextArea } from '@/components/ui/TextArea';
import type { QuestFormState } from '../questForm';
import { CoverPicker } from './CoverPicker';

interface BookFieldsSectionProps {
  /** Lets the page hold Save while a cover is still uploading. */
  onCoverUploadingChange: (uploading: boolean) => void;
}

/** The cover uploads on pick and lands as a URL, so Save treats it like any other text field. */
export function BookFieldsSection({ onCoverUploadingChange }: BookFieldsSectionProps) {
  const {
    register,
    control,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const e = errors.book;

  return (
    <>
      <Field label="Title" {...register('book.title')} {...statusFor(e?.title?.message)} />
      <Field label="Author" {...register('book.author')} {...statusFor(e?.author?.message)} />
      <Field
        label="Pages"
        type="number"
        inputMode="numeric"
        min={1}
        {...register('book.pages')}
        {...statusFor(e?.pages?.message)}
      />
      <Controller
        control={control}
        name="book.coverUrl"
        // Controller writes only this field, so a late upload can't overwrite other edits.
        render={({ field, fieldState }) => (
          <CoverPicker
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            onUploadingChange={onCoverUploadingChange}
          />
        )}
      />
      <TextArea
        label="Description"
        rows={4}
        placeholder="A shepherd boy leaves everything he knows…"
        {...register('book.description')}
        {...statusFor(e?.description?.message)}
      />
    </>
  );
}
```

`quest/components/PrizeFieldsSection.tsx`:

```tsx
import { useFormContext } from 'react-hook-form';
import { Field, statusFor } from '@/components/ui/Field';
import type { QuestFormState } from '../questForm';

/** Free text, all nullable; blank clears a prize back to `null`. */
export function PrizeFieldsSection() {
  const {
    register,
    formState: { errors }
  } = useFormContext<QuestFormState>();

  return (
    <>
      {/* Its own line: Field hides neutral messages (opacity 0), so a hint there never showed. */}
      <p className="m-0 text-sm text-taupe">Leave a place blank to clear its prize.</p>
      <Field label="First place" placeholder="AirPods Pro" {...register('prizes.first')} {...statusFor(errors.prizes?.first?.message)} />
      <Field label="Second place" placeholder="1,000,000 so‘m" {...register('prizes.second')} {...statusFor(errors.prizes?.second?.message)} />
      <Field label="Third place" placeholder="A year of books, on us" {...register('prizes.third')} {...statusFor(errors.prizes?.third?.message)} />
    </>
  );
}
```

`quest/components/QuizMetaFieldsSection.tsx`:

```tsx
import { useFormContext } from 'react-hook-form';
import { Field } from '@/components/ui/Field';
import type { QuestFormState } from '../questForm';

/** Only for the Home screen's "20 questions, 30 minutes" line; blank means undecided. */
export function QuizMetaFieldsSection() {
  const {
    register,
    formState: { errors }
  } = useFormContext<QuestFormState>();

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field
        label="Questions"
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="20"
        {...register('quizQuestionCount')}
        status={errors.quizQuestionCount ? 'bad' : undefined}
        message={errors.quizQuestionCount?.message}
      />
      <Field
        label="Minutes"
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="30"
        {...register('quizDurationMinutes')}
        status={errors.quizDurationMinutes ? 'bad' : undefined}
        message={errors.quizDurationMinutes?.message}
      />
    </div>
  );
}
```

`quest/components/QuestDateFieldsSection.tsx`. This is an interim version, deleted in Task 5; it exists so this task compiles and works:

```tsx
import { Controller, useFormContext } from 'react-hook-form';
import { QUEST_DATE_FIELDS } from '@bookquest/shared';
import { Field, statusFor } from '@/components/ui/Field';
import { DATE_LABEL } from '../../dates';
import type { QuestFormState } from '../questForm';

/** One Controller over the whole `dates` object, so an ordering error lands on whichever date it names. */
export function QuestDateFieldsSection() {
  const { control } = useFormContext<QuestFormState>();

  return (
    <Controller
      control={control}
      name="dates"
      render={({ field, formState: { errors } }) => (
        <>
          {QUEST_DATE_FIELDS.map((key) => (
            <Field
              key={key}
              type="datetime-local"
              label={DATE_LABEL[key]}
              value={field.value[key]}
              onChange={(event) => field.onChange({ ...field.value, [key]: event.target.value })}
              {...statusFor(errors.dates?.[key]?.message)}
            />
          ))}
        </>
      )}
    />
  );
}
```

`quest/components/ResourceListEditor.tsx`. This is also interim, rewritten in Task 6:

```tsx
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Field, statusFor } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { emptyResource, type QuestFormState } from '../questForm';

const RESOURCE_LIMIT = 12;

export function ResourceListEditor() {
  const {
    control,
    register,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const { fields, append, remove } = useFieldArray({ control, name: 'book.resources' });

  return (
    <>
      <ul className="flex flex-col gap-4">
        {fields.map((field, index) => {
          const rowErrors = errors.book?.resources?.[index];
          return (
            <li key={field.id} className="grid gap-3 border-b border-[color:var(--rule)] pb-4 sm:grid-cols-[1fr_2fr_auto]">
              <Field label="Label" {...register(`book.resources.${index}.label`)} {...statusFor(rowErrors?.label?.message)} />
              <Field label="URL" type="url" {...register(`book.resources.${index}.url`)} {...statusFor(rowErrors?.url?.message)} />
              <Button type="button" variant="quiet" onClick={() => remove(index)} className="min-h-11 self-end px-2">
                Remove
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="quiet"
        onClick={() => append(emptyResource())}
        disabled={fields.length >= RESOURCE_LIMIT}
        className="self-start px-2"
      >
        Add resource
      </Button>
    </>
  );
}
```

- [ ] **Step 5: `QuestFormFields`**

`quest/components/QuestFormFields.tsx`:

```tsx
import { useFormContext } from 'react-hook-form';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { DateInputs } from '../../dates';
import { sectionsWithErrors, type ChangeSummary, type EditorSectionId } from '../changes';
import { sectionSummaries } from '../summaries';
import type { QuestFormState } from '../questForm';
import { EditorSection } from './EditorSection';
import { BookFieldsSection } from './BookFieldsSection';
import { ResourceListEditor } from './ResourceListEditor';
import { PrizeFieldsSection } from './PrizeFieldsSection';
import { QuestDateFieldsSection } from './QuestDateFieldsSection';
import { QuizMetaFieldsSection } from './QuizMetaFieldsSection';

interface QuestFormFieldsProps {
  changes: ChangeSummary;
  /** The saved schedule — past dates in it lock (Task 5). `null` when creating. */
  savedDates: DateInputs | null;
  onCoverUploadingChange: (uploading: boolean) => void;
}

/** Every quest field, grouped. Shared by the editor and the new-edition page through form context. */
export function QuestFormFields({ changes, onCoverUploadingChange }: QuestFormFieldsProps) {
  const {
    watch,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const summaries = sectionSummaries(watch());
  const errored = sectionsWithErrors(errors);
  const isWide = useMediaQuery('(min-width: 1024px)');

  const section = (id: EditorSectionId) => ({
    summary: summaries[id],
    isDirty: changes.sections.has(id),
    hasError: errored.has(id),
    defaultOpen: isWide
  });

  return (
    <div className="flex flex-col">
      <EditorSection title="Book" {...section('book')}>
        <BookFieldsSection onCoverUploadingChange={onCoverUploadingChange} />
      </EditorSection>
      <EditorSection title="Resources" {...section('resources')}>
        <ResourceListEditor />
      </EditorSection>
      <EditorSection title="Prizes" {...section('prizes')}>
        <PrizeFieldsSection />
      </EditorSection>
      <EditorSection title="Dates" {...section('dates')}>
        <QuestDateFieldsSection />
      </EditorSection>
      <EditorSection title="Quiz" {...section('quiz')}>
        <QuizMetaFieldsSection />
      </EditorSection>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `QuestEditorPage.tsx`**

```tsx
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Quest, UpdateQuestPayload } from '@bookquest/shared';
import { useCurrentQuest } from '@/lib/api/quest';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { ApiRequestError } from '@/lib/api/client';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useSaveShortcut } from '@/hooks/useSaveShortcut';
import { useUiStore } from '@/stores/ui.store';
import { useUpdateQuest } from '../api/useUpdateQuest';
import { AdminQuery } from '../components/AdminQuery';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { SaveBar } from '../components/SaveBar';
import { UnsavedChangesSheet } from '../components/UnsavedChangesSheet';
import { QuestFormFields } from './components/QuestFormFields';
import { buildQuestPatch, toFormState, type QuestFormState } from './questForm';
import { questFormSchema } from './questFormSchema';
import { applyServerErrors } from './serverErrors';
import { countErrors, summarizeChanges } from './changes';

export const QUEST_FORM_ID = 'quest-form';

/** `/admin/quest` — the current quest's book, resources, prizes, dates and quiz settings. */
export function QuestEditorPage() {
  const quest = useCurrentQuest();

  return (
    <AdminQuery
      query={quest}
      loadingLabel="Opening the ledger…"
      notFound={(error) => (
        <EmptyState title={error.message} body="There's nothing to edit between editions." className="flex-1" />
      )}
    >
      {/* Keyed on id: a different current edition remounts with a clean form. */}
      {(data) => <QuestEditorForm key={data.id} quest={data} />}
    </AdminQuery>
  );
}

function QuestEditorForm({ quest }: { quest: Quest }) {
  const form = useForm<QuestFormState>({
    resolver: zodResolver(questFormSchema),
    defaultValues: toFormState(quest),
    mode: 'onChange'
  });
  const { handleSubmit, reset, setError, watch, formState } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const showToast = useUiStore((state) => state.showToast);
  const update = useUpdateQuest(quest.id);

  const values = watch();
  const changes = summarizeChanges(buildQuestPatch(quest, values));
  const isDirty = changes.count > 0;
  const errorCount = countErrors(formState.errors);
  const guard = useUnsavedChangesGuard(isDirty);

  async function save(patch: UpdateQuestPayload) {
    setFormError(null);
    try {
      const updated = await update.mutateAsync(patch);
      // The server's answer is the new baseline; later edits diff against what was saved.
      reset(toFormState(updated));
      showToast('Quest updated.');
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? applyServerErrors(error, setError) : FALLBACK_MESSAGE);
    }
  }

  const submit = handleSubmit((valid) => {
    const patch = buildQuestPatch(quest, valid);
    if (patch) void save(patch);
  });
  useSaveShortcut(isDirty ? () => void submit() : null);

  return (
    <FormProvider {...form}>
      <AdminScreen className="max-w-3xl">
        <AdminPageHeader eyebrow={`Quest · ${quest.year}`} title={quest.book.title} />

        <form id={QUEST_FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-6">
          <QuestFormFields changes={changes} savedDates={toFormState(quest).dates} onCoverUploadingChange={setIsCoverUploading} />
          {formError && (
            <p role="alert" className="m-0 text-sm text-error">
              {formError}
            </p>
          )}
        </form>

        {/* Room for the save bar, so the last section never hides under it. */}
        {isDirty && <div aria-hidden className="h-20" />}
      </AdminScreen>

      <SaveBar
        visible={isDirty}
        summary={errorCount > 0 ? `Fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'}` : `${changes.count} ${changes.count === 1 ? 'change' : 'changes'}`}
        tone={errorCount > 0 ? 'bad' : 'neutral'}
        submitLabel="Save"
        busyLabel="Saving…"
        isBusy={update.isPending}
        disabled={update.isPending || isCoverUploading}
        formId={QUEST_FORM_ID}
        onDiscard={() => {
          setFormError(null);
          reset();
        }}
      />
      <UnsavedChangesSheet blocker={guard.blocker} />
    </FormProvider>
  );
}
```

- [ ] **Step 7: Typecheck and manual check**

Run: `pnpm typecheck`. Expected: PASS.

Manual check at 390px, `/admin/quest`:
1. All five sections are collapsed, each showing a summary. The dates summary reads like "Opens 1 Mar · Quiz 5 Apr–7 Apr".
2. Open Book and change the title. The save bar slides in with "1 change" and Book shows an orange dot. Change it back: the bar leaves.
3. Add a trailing space to the title. The bar must not appear (the patch trims).
4. **Error in a collapsed section (Review Focus 5):** clear the title, collapse Book (it stays open because it has an error), and tap Save. Expected: "Fix 1 field", the Title field is focused, and no request is sent (Network tab).
5. **Invalid date (Review Focus 4):** open Dates and clear Opens. Expected: "Pick a date and time." under Opens, the Dates summary shows "Opens —", and nothing crashes.
6. Make a valid change and tap the **Participants** tab. Expected: the "Discard your changes?" sheet. "Keep editing" stays on the page; "Discard" navigates.
7. Make a valid change and press ⌘S at 1280px. Expected: the "Quest updated." toast and the bar hides.
8. Pick a cover, and while it uploads (throttle to Slow 3G) Save is disabled. After the upload the cover is part of the change count.
9. At 1280px all sections start open, and the save bar floats above the tab-bar pill.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/hooks apps/web/src/styles/shell.css apps/web/src/features/admin
git commit -m "feat(web): quest editor on react-hook-form with collapsible sections, save bar and leave guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dates timeline

**Files:**
- Modify: `apps/web/src/features/admin/dates.ts`
- Create: `features/admin/components/QuestTimeline.tsx`, `quest/components/DateTimelineField.tsx`
- Delete: `quest/components/QuestDateFieldsSection.tsx`
- Modify: `quest/components/QuestFormFields.tsx`

**Interfaces:**
- Consumes: `DATE_LABEL`, `GAP_LABEL`, `parseLocal`, `formatGap`, `DateInputs` (Task 3); `Field` `hideLabel`, `statusFor` (Task 1); `Switch` (existing).
- Produces:
  - `shiftLaterDates(dates: DateInputs, field: QuestDateField, nextValue: string): DateInputs`
  - `QuestTimeline({ dates: Record<QuestDateField, Date | null>; now: Date; renderValue: (field: QuestDateField) => ReactNode })`, also used by the Dashboard in Task 12
  - `DateTimelineField({ savedDates: DateInputs | null })`

- [ ] **Step 1: Add `shiftLaterDates` to `features/admin/dates.ts`**

Add `import { toDateTimeLocalInput } from '@/lib/format';` at the top, then append:

```ts
const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();
const localDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * Moves every later date by the same calendar days and wall-clock minutes as
 * `field` moved, so the schedule keeps its rhythm. Days and minutes rather than
 * raw milliseconds, so a daylight-saving change never turns 18:00 into 19:00.
 */
export function shiftLaterDates(dates: DateInputs, field: QuestDateField, nextValue: string): DateInputs {
  const next: DateInputs = { ...dates, [field]: nextValue };
  const before = parseLocal(dates[field]);
  const after = parseLocal(nextValue);
  if (!before || !after) return next;

  const dayShift = Math.round((localDay(after) - localDay(before)) / 86_400_000);
  const minuteShift = minutesOfDay(after) - minutesOfDay(before);

  for (const later of QUEST_DATE_FIELDS.slice(QUEST_DATE_FIELDS.indexOf(field) + 1)) {
    const current = parseLocal(dates[later]);
    if (!current) continue;
    const moved = new Date(current);
    moved.setDate(moved.getDate() + dayShift);
    moved.setMinutes(moved.getMinutes() + minuteShift);
    next[later] = toDateTimeLocalInput(moved.toISOString());
  }
  return next;
}
```

- [ ] **Step 2: `QuestTimeline`**

`features/admin/components/QuestTimeline.tsx`:

```tsx
import { Fragment, type ReactNode } from 'react';
import { QUEST_DATE_FIELDS, type QuestDateField } from '@bookquest/shared';
import { DATE_LABEL, GAP_LABEL, formatGap } from '../dates';

interface QuestTimelineProps {
  dates: Record<QuestDateField, Date | null>;
  now: Date;
  /** An input in the editor, formatted text on the Dashboard. */
  renderValue: (field: QuestDateField) => ReactNode;
}

type NodeState = 'passed' | 'next' | 'future';

const DOT: Record<NodeState, string> = {
  passed: 'bg-taupe-dim',
  next: 'bg-ember shadow-[0_0_0_4px_rgba(226,99,42,0.2)]',
  future: 'border border-[color:var(--rule-strong)] bg-ink'
};

/** The five dates as one rail: what's passed, what's next, how long each stretch is. */
export function QuestTimeline({ dates, now, renderValue }: QuestTimelineProps) {
  const firstFuture = QUEST_DATE_FIELDS.findIndex((field) => {
    const date = dates[field];
    return date === null || date > now;
  });
  // "Now" sits just before the first future date — or after the last one once everything has passed.
  const nowIndex = firstFuture === -1 ? QUEST_DATE_FIELDS.length : firstFuture;

  return (
    <ol className="relative m-0 flex list-none flex-col p-0 before:absolute before:bottom-3 before:left-[0.55rem] before:top-3 before:w-px before:bg-[color:var(--rule-strong)]">
      {QUEST_DATE_FIELDS.map((field, index) => {
        const state: NodeState = index < nowIndex ? 'passed' : index === nowIndex ? 'next' : 'future';
        const nextField = QUEST_DATE_FIELDS[index + 1];
        const gap = nextField ? formatGap(dates[field], dates[nextField]) : null;

        return (
          <Fragment key={field}>
            {index === nowIndex && index > 0 && <NowMarker />}
            <li className="relative grid grid-cols-[1.1rem_1fr] gap-x-3 py-2">
              <span aria-hidden className={`relative z-[1] mt-1 h-2.5 w-2.5 justify-self-center rounded-full ${DOT[state]}`} />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="type-label">{DATE_LABEL[field]}</span>
                {renderValue(field)}
              </div>
            </li>
            {gap && GAP_LABEL[field] && (
              <li aria-hidden className="grid grid-cols-[1.1rem_1fr] gap-x-3 pb-1">
                <span />
                <span className="text-xs text-taupe-dim">
                  {GAP_LABEL[field]} · {gap}
                </span>
              </li>
            )}
          </Fragment>
        );
      })}
      {nowIndex === QUEST_DATE_FIELDS.length && <NowMarker />}
    </ol>
  );
}

function NowMarker() {
  return (
    <li className="grid grid-cols-[1.1rem_1fr] items-center gap-x-3 py-1">
      <span aria-hidden className="relative z-[1] h-px w-full bg-ember" />
      <span className="type-label text-ember">Now</span>
    </li>
  );
}
```

- [ ] **Step 3: `DateTimelineField`, then wire it in**

`quest/components/DateTimelineField.tsx`:

```tsx
import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { QUEST_DATE_FIELDS, type QuestDateField } from '@bookquest/shared';
import { Field, statusFor } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { formatLongDate } from '@/lib/format';
import { DATE_LABEL, parseLocal, shiftLaterDates, type DateInputs } from '../../dates';
import { QuestTimeline } from '../../components/QuestTimeline';
import type { QuestFormState } from '../questForm';

type ShiftMode = 'keep' | 'single';

interface DateTimelineFieldProps {
  /** Saved schedule: a date already past in it is locked. `null` when creating — nothing is past. */
  savedDates: DateInputs | null;
}

export function DateTimelineField({ savedDates }: DateTimelineFieldProps) {
  const { control } = useFormContext<QuestFormState>();
  const [mode, setMode] = useState<ShiftMode>('keep');
  const [unlocked, setUnlocked] = useState<ReadonlySet<QuestDateField>>(new Set());
  const [now] = useState(() => new Date());

  const isLocked = (field: QuestDateField) => {
    const saved = savedDates ? parseLocal(savedDates[field]) : null;
    return saved !== null && saved <= now && !unlocked.has(field);
  };

  return (
    <Controller
      control={control}
      // One value for all five, so an ordering error lands on whichever date it names.
      name="dates"
      render={({ field, formState: { errors } }) => {
        const change = (key: QuestDateField, value: string) =>
          field.onChange(mode === 'keep' ? shiftLaterDates(field.value, key, value) : { ...field.value, [key]: value });

        const parsed = Object.fromEntries(
          QUEST_DATE_FIELDS.map((key) => [key, parseLocal(field.value[key])])
        ) as Record<QuestDateField, Date | null>;

        return (
          <>
            <Switch
              aria-label="When a date moves"
              options={[
                { value: 'keep', label: 'Keep the gaps' },
                { value: 'single', label: 'Move one date' }
              ]}
              value={mode}
              onChange={setMode}
            />
            <QuestTimeline
              dates={parsed}
              now={now}
              renderValue={(key) => {
                const date = parsed[key];
                if (isLocked(key) && date) {
                  return (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-paper-dim">{formatLongDate(date)} · passed</span>
                      <Button
                        type="button"
                        variant="quiet"
                        className="min-h-11 px-2 text-sm"
                        onClick={() => setUnlocked((prev) => new Set(prev).add(key))}
                      >
                        Edit anyway
                      </Button>
                    </div>
                  );
                }
                return (
                  <Field
                    type="datetime-local"
                    label={DATE_LABEL[key]}
                    hideLabel
                    value={field.value[key]}
                    onChange={(event) => change(key, event.target.value)}
                    {...statusFor(errors.dates?.[key]?.message)}
                  />
                );
              }}
            />
          </>
        );
      }}
    />
  );
}
```

Then:
1. `git rm apps/web/src/features/admin/quest/components/QuestDateFieldsSection.tsx`
2. In `QuestFormFields.tsx`:
   - Swap the import `QuestDateFieldsSection` for `import { DateTimelineField } from './DateTimelineField';`.
   - Destructure `savedDates` in the signature: `({ changes, savedDates, onCoverUploadingChange })`.
   - Render `<DateTimelineField savedDates={savedDates} />` inside the Dates section.

- [ ] **Step 4: Typecheck and manual check**

Run: `pnpm typecheck`. Expected: PASS.

Manual check at 390px, `/admin/quest`, Dates open. In the mock the current quest is in `reading`:
1. Opens shows as "… · passed" with "Edit anyway", and a "Now" marker sits between the passed and future dates. Gap lines read like "Reading · 42 days".
2. With **Keep the gaps**, move Quiz opens forward 2 days. Quiz closes and Results move by 2 days at the same clock time, and the change count goes up by 3.
3. **Error on the untouched field (Review Focus 2):** switch to **Move one date**, unlock Opens and set it after the reading deadline. Expected: "Reading has to end after the quest opens." appears under **Reading deadline**, not under Opens.
4. Clear the Quiz closes input. Expected: "Pick a date and time.", no gap line next to it, and no crash.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/admin
git commit -m "feat(web): quest dates as a timeline with keep-the-gaps and past-date locks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Paste-first resources

**Files:**
- Create: `quest/resources.ts`
- Rewrite: `quest/components/ResourceListEditor.tsx`
- Modify: `quest/questForm.ts` (delete `emptyResource`, unused after this task)

**Interfaces:**
- Consumes: `Select` (Task 1), `isValidResourceUrl` (questForm).
- Produces:
  - `RESOURCE_LIMIT = 12`
  - `inferKind(url: string): BookResourceKind`
  - `hostnameOf(url: string): string`
  - `defaultLabel(kind: BookResourceKind, url: string): string`
  - `KIND_OPTIONS: readonly SelectOption<BookResourceKind>[]`
  - `hostnameOf` is also used by `QuestPreview` in Task 8.

- [ ] **Step 1: `quest/resources.ts`**

```ts
import type { BookResourceKind } from '@bookquest/shared';
import type { SelectOption } from '@/components/ui/Select';

export const RESOURCE_LIMIT = 12;

export const KIND_OPTIONS: readonly SelectOption<BookResourceKind>[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'epub', label: 'EPUB' },
  { value: 'audio', label: 'Audio' },
  { value: 'link', label: 'Link' }
];

const AUDIO_HOSTS = ['audible.', 'storytel.', 'soundcloud.com', 'podcasts.apple.com', 'open.spotify.com', 'music.youtube.com'];

/** A best guess the admin can still change — it only saves them picking from a list. */
export function inferKind(url: string): BookResourceKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'link';
  }
  const path = parsed.pathname.toLowerCase();
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.epub')) return 'epub';
  if (/\.(mp3|m4a|m4b|aac|ogg)$/.test(path) || AUDIO_HOSTS.some((host) => parsed.hostname.includes(host))) {
    return 'audio';
  }
  return 'link';
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function defaultLabel(kind: BookResourceKind, url: string): string {
  switch (kind) {
    case 'pdf':
      return 'PDF';
    case 'epub':
      return 'EPUB';
    case 'audio':
      return 'Audiobook';
    case 'link':
      return hostnameOf(url);
  }
}
```

- [ ] **Step 2: Rewrite `ResourceListEditor.tsx`**

```tsx
import { useState } from 'react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import type { BookResourceKind } from '@bookquest/shared';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowDown, ArrowUp, BookOpen, FileText, Headphones, Link2 } from 'lucide-react';
import { Field, statusFor } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { isValidResourceUrl, type QuestFormState } from '../questForm';
import { KIND_OPTIONS, RESOURCE_LIMIT, defaultLabel, hostnameOf, inferKind } from '../resources';

const KIND_ICON: Record<BookResourceKind, LucideIcon> = {
  pdf: FileText,
  epub: BookOpen,
  audio: Headphones,
  link: Link2
};

/**
 * Paste a link and the row fills itself in; rows stay collapsed to one line
 * until tapped, so twelve links is still a short list on a phone.
 */
export function ResourceListEditor() {
  const {
    control,
    register,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'book.resources' });
  const resources = useWatch({ control, name: 'book.resources' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [draftError, setDraftError] = useState<string | undefined>();
  const isFull = fields.length >= RESOURCE_LIMIT;

  function add(raw: string) {
    const url = raw.trim();
    if (!url) return;
    if (!isValidResourceUrl(url)) {
      setDraftError('Paste a full link, starting with https://');
      return;
    }
    const kind = inferKind(url);
    append({ url, kind, label: defaultLabel(kind, url) });
    setDraftUrl('');
    setDraftError(undefined);
  }

  return (
    <>
      {fields.length === 0 ? (
        <p className="m-0 text-sm text-taupe">No reading resources yet. Paste a link to a PDF, an audiobook or a shop.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-[color:var(--rule)] p-0">
          {fields.map((field, index) => {
            const current = resources[index] ?? field;
            const rowErrors = errors.book?.resources?.[index];
            const isOpen = openId === field.id || Boolean(rowErrors);
            const Icon = KIND_ICON[current.kind];

            return (
              <li key={field.id} className="py-1">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : field.id)}
                  className="flex min-h-11 w-full items-center gap-3 text-left"
                >
                  <Icon aria-hidden className="h-4 w-4 shrink-0 text-taupe" />
                  <span className="min-w-0 flex-1 truncate text-paper">{current.label || 'Untitled'}</span>
                  <span className="max-w-[40%] truncate text-sm text-taupe-dim">{hostnameOf(current.url)}</span>
                  {rowErrors && <AlertTriangle aria-label="Has errors" className="h-4 w-4 shrink-0 text-error" />}
                </button>

                <div hidden={!isOpen} className="grid gap-3 pb-3 pt-1 sm:grid-cols-[1fr_2fr_8rem]">
                  <Field label="Label" {...register(`book.resources.${index}.label`)} {...statusFor(rowErrors?.label?.message)} />
                  <Field
                    label="URL"
                    type="url"
                    inputMode="url"
                    {...register(`book.resources.${index}.url`)}
                    {...statusFor(rowErrors?.url?.message)}
                  />
                  <Controller
                    control={control}
                    name={`book.resources.${index}.kind`}
                    render={({ field: kind }) => (
                      <Select label="Kind" options={KIND_OPTIONS} value={kind.value} onChange={kind.onChange} />
                    )}
                  />
                  <div className="flex items-center gap-1 sm:col-span-3">
                    <Button type="button" variant="quiet" aria-label="Move up" disabled={index === 0} onClick={() => move(index, index - 1)} className="min-h-11 px-2">
                      <ArrowUp aria-hidden className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      aria-label="Move down"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                      className="min-h-11 px-2"
                    >
                      <ArrowDown aria-hidden className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="quiet" onClick={() => remove(index)} className="ml-auto min-h-11 px-2">
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <Field
          className="flex-1"
          label={isFull ? `That's the limit of ${RESOURCE_LIMIT}` : `Add a link · ${fields.length}/${RESOURCE_LIMIT}`}
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={draftUrl}
          disabled={isFull}
          onChange={(event) => {
            setDraftUrl(event.target.value);
            setDraftError(undefined);
          }}
          // A pasted full URL is added straight away; anything else waits for Add or Enter.
          onPaste={(event) => {
            const text = event.clipboardData.getData('text').trim();
            if (!isValidResourceUrl(text)) return;
            event.preventDefault();
            add(text);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault(); // Enter would otherwise submit the whole quest form.
            add(draftUrl);
          }}
          {...statusFor(draftError)}
        />
        <Button
          type="button"
          variant="quiet"
          disabled={isFull || !draftUrl.trim()}
          onClick={() => add(draftUrl)}
          className="mb-[1.55rem] min-h-11 px-3"
        >
          Add
        </Button>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Remove `emptyResource`**

Delete the `emptyResource` function from `quest/questForm.ts`. `grep -rn emptyResource apps/web/src` must print nothing.

- [ ] **Step 4: Typecheck and manual check**

Run: `pnpm typecheck`. Expected: PASS.

Manual check at 390px, Resources open:
1. Paste `https://example.com/alchemist.pdf`. Expected: a row "PDF · example.com" with a file icon, the input clears, and the count reads "1/12".
2. Type `https://open.spotify.com/show/x` and press Enter. Expected: an "Audiobook" row with a headphones icon. The quest form does **not** submit.
3. Type `hello` and tap Add. Expected: "Paste a full link, starting with https://".
4. Tap a row, change its label, move it up, and remove another row. The summary line updates, and the change count counts the list as one change.
5. Clear a row's URL and collapse it. It stays open with the error icon.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/admin/quest
git commit -m "feat(web): paste-first resource list with kind inference and reordering

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Review sheet for risky edits on a live quest

**Files:**
- Create: `quest/review.ts`, `quest/components/ReviewChangesSheet.tsx`
- Modify: `quest/QuestEditorPage.tsx`

**Interfaces:**
- Consumes: `DATE_LABEL` (Task 3), `Sheet` (Task 1).
- Produces:
  - `interface ChangeLine { label: string; before: string; after: string }`
  - `needsReview(quest: Quest, patch: UpdateQuestPayload): boolean`
  - `describeRiskyChanges(quest: Quest, patch: UpdateQuestPayload): ChangeLine[]`
  - `ReviewChangesSheet({ open, lines, participantCount, onConfirm, onCancel })`

- [ ] **Step 1: `quest/review.ts`**

```ts
import { QUEST_DATE_FIELDS, type Quest, type UpdateQuestPayload } from '@bookquest/shared';
import { formatLongDate } from '@/lib/format';
import { DATE_LABEL } from '../dates';

export interface ChangeLine {
  label: string;
  before: string;
  after: string;
}

const PRIZE_LABEL = { first: 'First prize', second: 'Second prize', third: 'Third prize' } as const;

/** Only edits participants have already planned around get a second look; typos just save. */
export function needsReview(quest: Quest, patch: UpdateQuestPayload): boolean {
  if (quest.phase === 'upcoming') return false;
  return patch.prizes !== undefined || QUEST_DATE_FIELDS.some((field) => patch[field] !== undefined);
}

export function describeRiskyChanges(quest: Quest, patch: UpdateQuestPayload): ChangeLine[] {
  const lines: ChangeLine[] = [];

  for (const field of QUEST_DATE_FIELDS) {
    const next = patch[field];
    if (next) lines.push({ label: DATE_LABEL[field], before: formatLongDate(quest[field]), after: formatLongDate(next) });
  }
  for (const place of ['first', 'second', 'third'] as const) {
    const next = patch.prizes?.[place];
    if (next !== undefined) {
      lines.push({ label: PRIZE_LABEL[place], before: quest.prizes[place] ?? 'None', after: next ?? 'None' });
    }
  }
  return lines;
}
```

- [ ] **Step 2: `ReviewChangesSheet.tsx`**

```tsx
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { formatCount } from '@/lib/format';
import type { ChangeLine } from '../review';

interface ReviewChangesSheetProps {
  open: boolean;
  lines: ChangeLine[];
  participantCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReviewChangesSheet({ open, lines, participantCount, onConfirm, onCancel }: ReviewChangesSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title="Change a live quest?"
      actions={
        <>
          <Button type="button" variant="quiet" onClick={onCancel}>
            Keep editing
          </Button>
          <Button type="button" onClick={onConfirm}>
            Save changes
          </Button>
        </>
      }
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {lines.map((line) => (
          <li key={line.label} className="flex flex-col gap-0.5">
            <span className="type-label">{line.label}</span>
            <span className="text-sm text-taupe line-through">{line.before}</span>
            <span className="text-paper">{line.after}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-sm text-taupe">
        {formatCount(participantCount)} {participantCount === 1 ? 'participant sees' : 'participants see'} this straight away.
      </p>
    </Sheet>
  );
}
```

- [ ] **Step 3: Wire it into the editor**

In `quest/QuestEditorPage.tsx`, inside `QuestEditorForm`:

1. Imports: `import { ReviewChangesSheet } from './components/ReviewChangesSheet';` and `import { describeRiskyChanges, needsReview } from './review';`
2. Add state below `formError`: `const [pendingPatch, setPendingPatch] = useState<UpdateQuestPayload | null>(null);`
3. Replace the `submit` definition with:

```tsx
  const submit = handleSubmit((valid) => {
    const patch = buildQuestPatch(quest, valid);
    if (!patch) return;
    if (needsReview(quest, patch)) setPendingPatch(patch);
    else void save(patch);
  });
```

4. Before `<UnsavedChangesSheet …/>` add:

```tsx
      <ReviewChangesSheet
        open={pendingPatch !== null}
        lines={pendingPatch ? describeRiskyChanges(quest, pendingPatch) : []}
        participantCount={quest.participantCount}
        onCancel={() => setPendingPatch(null)}
        onConfirm={() => {
          const patch = pendingPatch;
          setPendingPatch(null);
          if (patch) void save(patch);
        }}
      />
```

- [ ] **Step 4: Typecheck and manual check**

Run: `pnpm typecheck`. Expected: PASS.

Manual check. The mock quest is in `reading`:
1. Change only the description and Save. It saves straight away with no sheet.
2. Change the first prize and move Quiz closes a day later, then Save. Expected: a sheet listing "First prize" and "Quiz closes" with old values struck through, plus "N participants see this straight away". "Keep editing" closes it without a request; "Save changes" saves and shows the toast.
3. The sheet is a bottom sheet at 390px and a centred dialog at 1280px, and Esc closes it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/admin/quest
git commit -m "feat(web): review sheet before changing dates or prizes on a live quest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Live preview

**Files:**
- Modify: `apps/web/src/components/BookHero.tsx`
- Create: `quest/components/QuestPreview.tsx`
- Modify: `quest/QuestEditorPage.tsx`

**Interfaces:**
- Consumes: `hostnameOf` (Task 6), `parseLocal` (Task 3), `Sheet` (Task 1).
- Produces:
  - `BookHero` prop `titleAs?: 'h1' | 'h2'` (default `'h1'`)
  - `QuestPreview({ edition: number; values: QuestFormState })`
  - `QuestEditorLayout({ preview: ReactNode; children: ReactNode })`
  - `PreviewButton({ preview: ReactNode })`
  - All three are also used by the new-edition page in Task 9.

- [ ] **Step 1: `BookHero` heading level**

In `apps/web/src/components/BookHero.tsx`:
- Add `titleAs?: 'h1' | 'h2';` to `BookHeroProps`.
- Destructure it as `titleAs: Title = 'h1'`.
- Change `<h1 className="type-display text-3xl text-paper">{title}</h1>` to `<Title className="type-display text-3xl text-paper">{title}</Title>`.

- [ ] **Step 2: `QuestPreview.tsx`**

```tsx
import { useState, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { BookHero } from '@/components/BookHero';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { parseLocal } from '../../dates';
import { hostnameOf } from '../resources';
import type { QuestFormState } from '../questForm';

const PLACES = [
  ['1st', 'first'],
  ['2nd', 'second'],
  ['3rd', 'third']
] as const;

/** The participant-facing `BookHero`, fed unsaved values — the preview can't drift from the real screen. */
export function QuestPreview({ edition, values }: { edition: number; values: QuestFormState }) {
  const { book, prizes } = values;
  const pages = Number(book.pages);
  const year = parseLocal(values.dates.opensAt)?.getFullYear() ?? new Date().getFullYear();
  const prizeRows = PLACES.map(([place, key]) => [place, prizes[key].trim()] as const).filter(([, prize]) => prize);

  return (
    <div className="flex flex-col gap-5 rounded-box border border-[color:var(--rule)] p-4">
      <p className="type-label m-0">What participants see</p>
      <BookHero
        titleAs="h2"
        edition={edition}
        year={year}
        title={book.title.trim() || 'Untitled'}
        author={book.author.trim() || 'Unknown author'}
        pages={Number.isFinite(pages) && pages > 0 ? pages : 0}
        coverUrl={book.coverUrl || null}
      />
      {book.description.trim() && <p className="m-0 whitespace-pre-line text-paper-dim">{book.description.trim()}</p>}
      {book.resources.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {book.resources.map((resource, index) => (
            <li key={index} className="rounded-chip border border-[color:var(--rule)] px-2 py-1 text-sm text-paper-dim">
              {resource.label.trim() || hostnameOf(resource.url)}
            </li>
          ))}
        </ul>
      )}
      {prizeRows.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
          {prizeRows.map(([place, prize]) => (
            <li key={place} className="text-paper-dim">
              <span className="type-label mr-2">{place}</span>
              {prize}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Form on the left, sticky preview on the right from `lg`; below that the preview lives in a sheet. */
export function QuestEditorLayout({ preview, children }: { preview: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div className="min-w-0">{children}</div>
      <aside className="hidden lg:sticky lg:top-6 lg:block">{preview}</aside>
    </div>
  );
}

export function PreviewButton({ preview }: { preview: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="quiet" onClick={() => setOpen(true)} className="min-h-11 px-3 lg:hidden">
        <Eye aria-hidden className="h-4 w-4" />
        Preview
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Preview"
        actions={
          <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        {preview}
      </Sheet>
    </>
  );
}
```

- [ ] **Step 3: Use it in the editor**

In `quest/QuestEditorPage.tsx`:
1. `import { PreviewButton, QuestEditorLayout, QuestPreview } from './components/QuestPreview';`
2. Change `<AdminScreen className="max-w-3xl">` to `<AdminScreen className="max-w-5xl">`.
3. Below `const values = watch();` add `const preview = <QuestPreview edition={quest.edition} values={values} />;`
4. Header: `<AdminPageHeader eyebrow={`Quest · ${quest.year}`} title={quest.book.title} actions={<PreviewButton preview={preview} />} />`
5. Wrap the `<form …>…</form>` in `<QuestEditorLayout preview={preview}> … </QuestEditorLayout>`.

- [ ] **Step 4: Typecheck and manual check**

Run: `pnpm typecheck`. Expected: PASS.

Manual check:
- At 1280px, the preview sits on the right and follows the page as you scroll. Typing in Title updates it on every keystroke, and removing the cover shows the drawn cover.
- At 390px, the preview panel is hidden. The header's "Preview" button opens it in a sheet.
- `/book` and `/quests/:edition` still render their `h1` (default `titleAs`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/BookHero.tsx apps/web/src/features/admin/quest
git commit -m "feat(web): live participant preview in the quest editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase C · Next edition

### Task 9: Start next edition (API `makeCurrent` + `/admin/quest/new`)

**Files:**
- Modify: `packages/shared/src/schemas/admin.ts`
- Modify: `apps/api/src/services/quest.services.ts`, `apps/api/src/controllers/admin/quest.controllers.ts`
- Modify: `apps/web/src/lib/api/mock/routes.ts`
- Modify: `apps/web/src/features/admin/dates.ts`, `api/adminKeys.ts`
- Create: `api/useLatestQuest.ts`, `api/useCreateQuest.ts`, `quest/nextEdition.ts`, `quest/NewEditionPage.tsx`
- Modify: `apps/web/src/app/router.tsx`, `quest/QuestEditorPage.tsx`

**Interfaces:**
- Consumes: `QuestFormFields`, `NO_CHANGES`, `SaveBar`, `UnsavedChangesSheet`, `useUnsavedChangesGuard` (with `bypass`), `applyServerErrors`, `QuestPreview` / `QuestEditorLayout` / `PreviewButton`, `trimmedOrNull` / `toResources` / `toOptionalCount`, `formDates`, `toFormState`.
- Produces:
  - `createQuestSchema.makeCurrent: boolean` (default `false`)
  - `defaultDates(now: Date): DateInputs`
  - `plusOneYear(iso: string): string`
  - `adminKeys.latestQuest()`
  - `type LatestQuest = { quest: Quest; isCurrent: boolean } | null`
  - `useLatestQuest()`
  - `useCreateQuest()`
  - `interface EditionDraft { edition: number; values: QuestFormState }`
  - `nextEditionDraft(source: Quest | null, now: Date): EditionDraft`
  - `buildCreatePayload(edition: number, values: QuestFormState): CreateQuestPayload`
  - `NewEditionPage` at `/admin/quest/new`

- [ ] **Step 1: Shared schema**

In `packages/shared/src/schemas/admin.ts`, inside `createQuestSchema`'s object, after `quizDurationMinutes: …default(null)`:

```ts
  ,
  /** Swap the current edition in the same transaction, so "created but not live" can't happen. */
  makeCurrent: z.boolean().default(false)
```

(Put the comma where the existing trailing entry needs it. The object must end `quizDurationMinutes: …, makeCurrent: …`.)

- [ ] **Step 2: API — honour `makeCurrent`**

In `apps/api/src/services/quest.services.ts`, add `import { withTransaction } from '../utils/transaction.js';` if it isn't already imported (`makeQuestCurrent` uses it, so it is). Replace `createQuest` with:

```ts
export async function createQuest(payload: CreateQuestPayload): Promise<Quest> {
  const { makeCurrent, ...fields } = payload;

  const issues = findQuestDateIssues({
    opensAt: fields.opensAt,
    readingDeadline: fields.readingDeadline,
    quizOpensAt: fields.quizOpensAt,
    quizClosesAt: fields.quizClosesAt,
    resultsAt: fields.resultsAt
  });
  if (issues) throw badDates(issues);

  try {
    // Inserted inside the callback: a retried transaction must insert afresh, not reuse a rolled-back document.
    const quest = await withTransaction(async (session) => {
      const [created] = await QuestModel.create([{ ...fields, isCurrent: false }], { session });
      if (!created) throw new Error('Quest insert returned no document.');

      if (makeCurrent) {
        // Unset first: the partial unique index allows one current quest at any instant.
        await QuestModel.updateMany({ isCurrent: true }, { $set: { isCurrent: false } }, { session });
        await QuestModel.updateOne({ _id: created._id }, { $set: { isCurrent: true } }, { session });
        created.isCurrent = true;
      }
      return created;
    });
    return toQuestDto(quest);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw ApiError.conflict(`Edition ${fields.edition} already exists.`);
    }
    throw error;
  }
}
```

In `apps/api/src/controllers/admin/quest.controllers.ts`, change the audit line in `createQuest` to:

```ts
  auditAdmin(req, 'create-quest', { edition: quest.edition, makeCurrent: (req.body as CreateQuestPayload).makeCurrent });
```

- [ ] **Step 3: Mock — honour `makeCurrent`**

In `apps/web/src/lib/api/mock/routes.ts`:

1. Pull the state change out of `makeQuestCurrent` into a helper above it:

```ts
/** Swaps the current edition; the outgoing one joins the archive and the roster follows its edition. */
function switchCurrent(target: Quest): void {
  updateState((draft) => {
    const outgoing = draft.quest;
    draft.archive = [
      ...(draft.questRunning ? [{ quest: outgoing, winner: null }] : []),
      ...draft.archive.filter((entry) => entry.quest.id !== target.id && entry.quest.id !== outgoing.id)
    ];
    draft.quest = target;
    draft.participants = draft.participants.filter((entry) => entry.questId === target.id);
    draft.myParticipantId = null;
    draft.questRunning = true;
  });
}
```

   Then in `makeQuestCurrent`, replace its `updateState((draft) => { … })` block with `switchCurrent(target);`.
2. In `createQuest`, after the `updateState((draft) => { draft.archive = [...] })` call, add:

```ts
  if (input.makeCurrent) {
    switchCurrent(quest);
    return created(readQuest(quest, 0));
  }
```

- [ ] **Step 4: Web date helpers**

Append to `apps/web/src/features/admin/dates.ts`:

```ts
/** Same calendar position a year on — the natural first guess for next year's schedule. */
export function plusOneYear(iso: string): string {
  const date = new Date(iso);
  date.setFullYear(date.getFullYear() + 1);
  return toDateTimeLocalInput(date.toISOString());
}

/** A sensible first schedule when there's no previous edition to copy: 60 days' reading, a 2-day quiz. */
export function defaultDates(now: Date): DateInputs {
  const at = (days: number, hour: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + 7 + days);
    date.setHours(hour, 0, 0, 0);
    return toDateTimeLocalInput(date.toISOString());
  };
  return {
    opensAt: at(0, 9),
    readingDeadline: at(60, 18),
    quizOpensAt: at(60, 18),
    quizClosesAt: at(62, 18),
    resultsAt: at(63, 12)
  };
}
```

- [ ] **Step 5: Keys, queries and the draft**

In `api/adminKeys.ts`, add to the object:

```ts
  latestQuest: () => [...adminKeys.all, 'latestQuest'] as const,
```

`api/useLatestQuest.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { CursorPage, Quest, QuestSummary } from '@bookquest/shared';
import { api, isNotFound } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

export type LatestQuest = { quest: Quest; isCurrent: boolean } | null;

/** What the next edition copies from: the current quest, else the newest archived one, else nothing (edition 1). */
export function useLatestQuest() {
  return useQuery({
    queryKey: adminKeys.latestQuest(),
    queryFn: async (): Promise<LatestQuest> => {
      try {
        return { quest: await api.get<Quest>('/quests/current'), isCurrent: true };
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      const archive = await api.get<CursorPage<QuestSummary>>('/quests?limit=1');
      const newest = archive.items[0];
      return newest ? { quest: await api.get<Quest>(`/quests/${newest.edition}`), isCurrent: false } : null;
    }
  });
}
```

`api/useCreateQuest.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateQuestPayload, Quest } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { questKeys } from '@/lib/api/quest';

export function useCreateQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateQuestPayload) => api.post<Quest>('/admin/quests', payload),
    onSuccess: (quest) => {
      queryClient.setQueryData(questKeys.current(), quest);
      // A new edition changes nearly every screen: roster, results, archive, profile, stats.
      void queryClient.invalidateQueries();
    }
  });
}
```

`quest/nextEdition.ts`:

```ts
import type { CreateQuestPayload, Quest } from '@bookquest/shared';
import { defaultDates, plusOneYear } from '../dates';
import { formDates, toFormState, toOptionalCount, toResources, trimmedOrNull, type QuestFormState } from './questForm';

export interface EditionDraft {
  edition: number;
  values: QuestFormState;
}

const EMPTY_BOOK: QuestFormState['book'] = {
  title: '',
  author: '',
  pages: '',
  coverUrl: '',
  description: '',
  resources: []
};

/**
 * Prizes, quiz settings and the schedule carry over (a year later); the book
 * is new every year, so it starts blank. A source old enough that "a year
 * later" is still past falls back to a fresh schedule.
 */
export function nextEditionDraft(source: Quest | null, now: Date): EditionDraft {
  if (!source) {
    return {
      edition: 1,
      values: {
        book: EMPTY_BOOK,
        prizes: { first: '', second: '', third: '' },
        dates: defaultDates(now),
        quizQuestionCount: '',
        quizDurationMinutes: ''
      }
    };
  }

  const carried = toFormState(source);
  const shifted = {
    opensAt: plusOneYear(source.opensAt),
    readingDeadline: plusOneYear(source.readingDeadline),
    quizOpensAt: plusOneYear(source.quizOpensAt),
    quizClosesAt: plusOneYear(source.quizClosesAt),
    resultsAt: plusOneYear(source.resultsAt)
  };

  return {
    edition: source.edition + 1,
    values: {
      ...carried,
      book: EMPTY_BOOK,
      dates: new Date(shifted.opensAt) > now ? shifted : defaultDates(now)
    }
  };
}

/** Year follows the opening date, so a quest opening in January is filed under that year. */
export function buildCreatePayload(edition: number, values: QuestFormState): CreateQuestPayload {
  const dates = formDates(values);

  return {
    edition,
    year: dates.opensAt.getFullYear(),
    book: {
      title: values.book.title.trim(),
      author: values.book.author.trim(),
      pages: Number(values.book.pages),
      coverUrl: trimmedOrNull(values.book.coverUrl),
      description: trimmedOrNull(values.book.description),
      resources: toResources(values.book.resources)
    },
    prizes: {
      first: trimmedOrNull(values.prizes.first),
      second: trimmedOrNull(values.prizes.second),
      third: trimmedOrNull(values.prizes.third)
    },
    ...dates,
    quizQuestionCount: toOptionalCount(values.quizQuestionCount),
    quizDurationMinutes: toOptionalCount(values.quizDurationMinutes),
    makeCurrent: true
  };
}
```

- [ ] **Step 6: `NewEditionPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateQuestPayload } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ApiRequestError } from '@/lib/api/client';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useUiStore } from '@/stores/ui.store';
import { useLatestQuest, type LatestQuest } from '../api/useLatestQuest';
import { useCreateQuest } from '../api/useCreateQuest';
import { AdminQuery } from '../components/AdminQuery';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { SaveBar } from '../components/SaveBar';
import { UnsavedChangesSheet } from '../components/UnsavedChangesSheet';
import { QuestFormFields } from './components/QuestFormFields';
import { PreviewButton, QuestEditorLayout, QuestPreview } from './components/QuestPreview';
import { NO_CHANGES, countErrors } from './changes';
import { buildCreatePayload, nextEditionDraft } from './nextEdition';
import { questFormSchema } from './questFormSchema';
import { applyServerErrors } from './serverErrors';
import type { QuestFormState } from './questForm';

const FORM_ID = 'new-edition-form';

/** `/admin/quest/new` — a sub-page of the quest tab, so it gets Telegram's back button. */
export function NewEditionPage() {
  useTelegramBackButton('/admin/quest');
  const latest = useLatestQuest();

  return (
    <AdminQuery query={latest} loadingLabel="Finding the last edition…">
      {(source) =>
        source?.isCurrent && source.quest.phase !== 'finished' ? (
          <EmptyState
            title={`Edition ${source.quest.edition} is still running`}
            body="Start the next edition once its quiz has closed."
            action={
              <Button to="/admin/quest" variant="quiet">
                Back to the quest
              </Button>
            }
            className="flex-1"
          />
        ) : (
          <NewEditionForm key={source?.quest.id ?? 'first'} source={source} />
        )
      }
    </AdminQuery>
  );
}

function NewEditionForm({ source }: { source: LatestQuest }) {
  const [draft] = useState(() => nextEditionDraft(source?.quest ?? null, new Date()));
  const form = useForm<QuestFormState>({
    resolver: zodResolver(questFormSchema),
    defaultValues: draft.values,
    mode: 'onChange'
  });
  const { handleSubmit, setError, watch, formState } = form;
  const [payload, setPayload] = useState<CreateQuestPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const create = useCreateQuest();
  const navigate = useNavigate();
  const showToast = useUiStore((state) => state.showToast);
  const guard = useUnsavedChangesGuard(formState.isDirty);

  const values = watch();
  const preview = <QuestPreview edition={draft.edition} values={values} />;
  const errorCount = countErrors(formState.errors);

  const submit = handleSubmit((valid) => {
    setFormError(null);
    setPayload(buildCreatePayload(draft.edition, valid));
  });

  async function confirm() {
    if (!payload) return;
    try {
      await create.mutateAsync(payload);
      guard.bypass();
      showToast(`Edition ${draft.edition} is live.`);
      navigate('/admin/quest');
    } catch (error) {
      setPayload(null);
      setFormError(error instanceof ApiRequestError ? applyServerErrors(error, setError) : FALLBACK_MESSAGE);
    }
  }

  return (
    <FormProvider {...form}>
      <AdminScreen className="max-w-5xl">
        <AdminPageHeader eyebrow="New edition" title={`Edition ${draft.edition}`} actions={<PreviewButton preview={preview} />} />
        <p className="m-0 text-sm text-taupe">
          {source
            ? `Prizes, quiz settings and the schedule carry over from edition ${source.quest.edition}, a year later. The book starts blank.`
            : 'The first edition. The schedule below is a starting point — adjust it to taste.'}
        </p>

        <QuestEditorLayout preview={preview}>
          <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-6">
            <QuestFormFields changes={NO_CHANGES} savedDates={null} onCoverUploadingChange={setIsCoverUploading} />
            {formError && (
              <p role="alert" className="m-0 text-sm text-error">
                {formError}
              </p>
            )}
          </form>
        </QuestEditorLayout>

        <div aria-hidden className="h-20" />
      </AdminScreen>

      <SaveBar
        visible
        summary={errorCount > 0 ? `Fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'}` : `Edition ${draft.edition}, ready when the book is in`}
        tone={errorCount > 0 ? 'bad' : 'neutral'}
        submitLabel="Create edition"
        busyLabel="Creating…"
        isBusy={create.isPending}
        disabled={create.isPending || isCoverUploading}
        formId={FORM_ID}
        onDiscard={() => navigate('/admin/quest')}
        discardLabel="Cancel"
      />

      <Sheet
        open={payload !== null}
        onClose={() => setPayload(null)}
        title={`Make edition ${draft.edition} current?`}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setPayload(null)}>
              Not yet
            </Button>
            <Button type="button" onClick={() => void confirm()} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create and go live'}
            </Button>
          </>
        }
      >
        <p className="m-0 text-taupe">
          {source?.isCurrent ? `Edition ${source.quest.edition} and its results move to the archive. ` : ''}
          Participants see edition {draft.edition} on the Home screen straight away.
        </p>
      </Sheet>

      <UnsavedChangesSheet blocker={guard.blocker} />
    </FormProvider>
  );
}
```

- [ ] **Step 7: Route and entry points**

In `apps/web/src/app/router.tsx`:
- Import `import { NewEditionPage } from '@/features/admin/quest/NewEditionPage';`
- In the admin children, after `{ path: 'quest', … }`, add `{ path: 'quest/new', element: <NewEditionPage /> },`.

In `quest/QuestEditorPage.tsx`:
1. Import `import { Button } from '@/components/ui/Button';`
2. Give the `notFound` empty state an action: `action={<Button to="/admin/quest/new">Start next edition</Button>}`.
3. In the editor header, show the next-edition link once the quest is finished:

```tsx
        <AdminPageHeader
          eyebrow={`Quest · ${quest.year}`}
          title={quest.book.title}
          actions={
            <>
              {quest.phase === 'finished' && (
                <Button to="/admin/quest/new" variant="quiet" className="min-h-11 px-3">
                  Next edition
                </Button>
              )}
              <PreviewButton preview={preview} />
            </>
          }
        />
```

- [ ] **Step 8: Typecheck and manual check**

Run: `pnpm typecheck`. Expected: PASS.

Manual check, mock API (`mockApi.reset()` first):
1. `/admin/quest/new` while the mock quest is in `reading`: the "Edition N is still running" empty state appears, and Telegram's back button (inside a Mini App) or the header link returns to the quest.
2. Make the mock quest finished: in the console run `mockApi.setPhase('finished')`, then reload.
3. On `/admin/quest`, "Next edition" appears in the header. Open it. The dates are a year after the current ones, the prizes and quiz settings are copied, and the book is blank.
4. Tap "Create edition" with a blank book: "Fix 3 fields" (title, author, pages) and the Book section is open.
5. Fill in the book and tap "Create edition". The sheet shows "Make edition N current?" with the archive sentence. Tap "Create and go live".
6. **Stale guard (Review Focus 1):** no "Discard your changes?" sheet appears. You land on `/admin/quest` showing the new title, with the toast "Edition N is live.". Home (`/`) shows the new book, and `/quests` lists the previous edition.
7. Open `/admin/quest/new` again, type a title, and tap Cancel. The discard sheet appears.
8. API check (optional, needs a local Mongo): `POST /api/v1/admin/quests` with `makeCurrent: true` twice with the same edition. The second answers `409 "Edition N already exists."`, and exactly one quest has `isCurrent: true`.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/schemas/admin.ts apps/api/src/services/quest.services.ts \
  apps/api/src/controllers/admin/quest.controllers.ts apps/web/src/lib/api/mock/routes.ts \
  apps/web/src/app/router.tsx apps/web/src/features/admin
git commit -m "feat: start the next edition from the admin, created and made current atomically

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase D · Broadcast

### Task 10: Background broadcast delivery and history (API + shared + mock)

**Files:**
- Modify: `packages/shared/src/schemas/notification.ts`
- Modify: `apps/api/src/models/broadcast.model.ts`, `services/broadcast.services.ts`, `controllers/admin/broadcast.controllers.ts`, `routes/admin/broadcast.routes.ts`, `server.ts`
- Modify: `apps/web/src/lib/api/mock/routes.ts`, `apps/web/src/features/admin/BroadcastPage.tsx` (one-line compile fix)

**Interfaces:**
- Produces (shared):
  - `BROADCAST_MAX_LENGTH = 1000`
  - `BROADCAST_STATUSES = ['sending', 'sent', 'interrupted'] as const`
  - `type BroadcastStatus`
  - `Broadcast` gains `status`, `dmCount`, `sentCount`, `failedCount`, `completedAt: string | null`
  - `interface BroadcastList { items: Broadcast[]; audience: number; dmAudience: number }`
- Produces (API):
  - `POST /api/v1/admin/broadcasts` → **202** `Broadcast` (`status: 'sending'`)
  - `GET /api/v1/admin/broadcasts` → `BroadcastList` (latest 20)
  - `markInterruptedBroadcasts(): Promise<number>`

- [ ] **Step 1: Shared schema**

Replace the broadcast half of `packages/shared/src/schemas/notification.ts` (from `/** What admin submits from the Broadcast screen. */` to the end) with:

```ts
/** One cap, read by the schema and the composer's counter. */
export const BROADCAST_MAX_LENGTH = 1000;

/** What admin submits from the Broadcast screen. */
export const createBroadcastSchema = z.strictObject({
  message: z
    .string()
    .trim()
    .min(1, 'Say something.')
    .max(BROADCAST_MAX_LENGTH, `Keep it under ${BROADCAST_MAX_LENGTH} characters.`)
});

export type CreateBroadcastPayload = z.infer<typeof createBroadcastSchema>;

export const BROADCAST_STATUSES = ['sending', 'sent', 'interrupted'] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

/** One row in admin's sent-broadcast history. Everyone gets it in-app; `dmCount` of them also on Telegram. */
export const broadcastSchema = z.object({
  id: z.string(),
  message: z.string(),
  status: z.enum(BROADCAST_STATUSES),
  recipientCount: z.number().int().nonnegative(),
  dmCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  completedAt: z.string().nullable()
});

export type Broadcast = z.infer<typeof broadcastSchema>;

export interface BroadcastList {
  items: Broadcast[];
  /** Every user: who a broadcast reaches in-app. */
  audience: number;
  /** Users with Telegram linked: who also gets a DM. */
  dmAudience: number;
}
```

- [ ] **Step 2: Model**

In `apps/api/src/models/broadcast.model.ts`, add `import { BROADCAST_STATUSES } from '@bookquest/shared';`. Add these fields to the schema after `recipientCount`:

```ts
    // Default 'sent', not 'sending': rows written before this field existed were delivered in-request.
    status: { type: String, enum: BROADCAST_STATUSES, default: 'sent' },
    dmCount: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date, default: null }
```

- [ ] **Step 3: Service**

Replace `apps/api/src/services/broadcast.services.ts` with:

```ts
import type { Types } from 'mongoose';
import type { Broadcast, BroadcastList, BroadcastStatus } from '@bookquest/shared';
import { UserModel } from '../models/user.model.js';
import { BroadcastModel, type BroadcastDocument } from '../models/broadcast.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { sendTelegramMessage } from '../utils/telegram-send.js';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';

const HISTORY_LIMIT = 20;
/** Progress is written every N sends — often enough for a live bar, rare enough not to double the writes. */
const PROGRESS_EVERY = 25;
/** Telegram's bot-wide limit is ~30 msg/s; this project has no queue, so spacing is the whole mitigation. */
const SEND_SPACING_MS = 35;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Writes the record and every in-app notification, then answers. DMs go out
 * after the response — at 1,000+ users they take minutes, longer than any
 * proxy will hold a request. The API is a long-running process, so the loop
 * outlives the request; `GET /admin/broadcasts` reports its progress.
 */
export async function sendBroadcast(message: string, createdBy: UserDocument): Promise<Broadcast> {
  const recipients = await UserModel.find({}, { _id: 1, telegramUserId: 1 });
  const dmTargets = recipients.flatMap((recipient) => (recipient.telegramUserId ? [recipient.telegramUserId] : []));

  const broadcast = await BroadcastModel.create({
    message,
    createdBy: createdBy._id,
    status: 'sending',
    recipientCount: recipients.length,
    dmCount: dmTargets.length
  });

  // Every Notification row exists before any DM is attempted: the in-app feed is all-or-nothing.
  if (recipients.length > 0) {
    await NotificationModel.insertMany(
      recipients.map((recipient) => ({
        user: recipient._id,
        kind: 'broadcast' as const,
        title: 'BookQuest',
        body: message,
        broadcast: broadcast._id
      }))
    );
  }

  void deliver(broadcast._id, dmTargets, message);
  return toBroadcastDto(broadcast);
}

async function deliver(broadcastId: Types.ObjectId, targets: string[], message: string): Promise<void> {
  let sentCount = 0;
  let failedCount = 0;

  try {
    for (const [index, target] of targets.entries()) {
      // sendTelegramMessage never throws for one bad recipient; it reports false.
      if (await sendTelegramMessage(target, message)) sentCount += 1;
      else failedCount += 1;

      if ((index + 1) % PROGRESS_EVERY === 0) {
        await BroadcastModel.updateOne({ _id: broadcastId }, { $set: { sentCount, failedCount } });
      }
      await sleep(SEND_SPACING_MS);
    }
    await BroadcastModel.updateOne(
      { _id: broadcastId },
      { $set: { sentCount, failedCount, status: 'sent', completedAt: new Date() } }
    );
  } catch (error) {
    logger.error({ err: error, broadcastId }, 'Broadcast delivery stopped');
    await BroadcastModel.updateOne(
      { _id: broadcastId },
      { $set: { sentCount, failedCount, status: 'interrupted', completedAt: new Date() } }
    ).catch(() => undefined);
  }
}

export async function listBroadcasts(): Promise<BroadcastList> {
  const [items, audience, dmAudience] = await Promise.all([
    BroadcastModel.find().sort({ createdAt: -1 }).limit(HISTORY_LIMIT),
    UserModel.countDocuments({}),
    UserModel.countDocuments({ telegramUserId: { $type: 'string' } })
  ]);
  return { items: items.map(toBroadcastDto), audience, dmAudience };
}

/**
 * A restart kills any delivery loop mid-way; without this its row would say
 * "sending" forever and the admin screen would poll forever. Assumes one API
 * instance — with several, a booting one would mark another's live send.
 */
export async function markInterruptedBroadcasts(): Promise<number> {
  const result = await BroadcastModel.updateMany(
    { status: 'sending' },
    { $set: { status: 'interrupted', completedAt: new Date() } }
  );
  return result.modifiedCount;
}

function toBroadcastDto(broadcast: BroadcastDocument): Broadcast {
  return {
    id: broadcast.id,
    message: broadcast.message,
    status: broadcast.status as BroadcastStatus,
    recipientCount: broadcast.recipientCount,
    dmCount: broadcast.dmCount,
    sentCount: broadcast.sentCount,
    failedCount: broadcast.failedCount,
    createdAt: broadcast.createdAt.toISOString(),
    completedAt: broadcast.completedAt?.toISOString() ?? null
  };
}
```

- [ ] **Step 4: Controller, route and boot sweep**

`apps/api/src/controllers/admin/broadcast.controllers.ts`: change `ok(res, broadcast, 201);` to `ok(res, broadcast, 202);` and update its doc comment to `/** POST /api/v1/admin/broadcasts — 202: accepted, delivery continues in the background. */`. Then append:

```ts
/** GET /api/v1/admin/broadcasts */
export async function listBroadcasts(_req: Request, res: Response): Promise<void> {
  ok(res, await broadcastService.listBroadcasts());
}
```

`apps/api/src/routes/admin/broadcast.routes.ts`: add `adminBroadcastRoutes.get('/', adminBroadcastController.listBroadcasts);` above the `post`.

`apps/api/src/server.ts`: add `import { markInterruptedBroadcasts } from './services/broadcast.services.js';`, and right after `await connectToDatabase();`:

```ts
  const interrupted = await markInterruptedBroadcasts();
  if (interrupted > 0) logger.warn({ interrupted }, 'Marked broadcasts left mid-send by the last shutdown as interrupted');
```

- [ ] **Step 5: Mock, and a compile fix for the old page**

In `apps/web/src/lib/api/mock/routes.ts`:
- Add `createBroadcastSchema` to the value import from `@bookquest/shared`, and `Broadcast` and `BroadcastList` to the type import.
- Above the route table, add:

```ts
/* ── Broadcasts ──────────────────────────────────────────────────────────── */

/** Not in MockState: nothing else reads it, and a reload clearing the outbox is fine. */
let outbox: Array<{ broadcast: Broadcast; startedAt: number }> = [];
const MOCK_SEND_MS = 40;

function audience(): { audience: number; dmAudience: number } {
  const total = getState().participants.length + 12;
  return { audience: total, dmAudience: Math.round(total * 0.8) };
}

/** Progress is derived from elapsed time, so the screen's polling has something to watch. */
function progressed({ broadcast, startedAt }: (typeof outbox)[number]): Broadcast {
  const sentCount = Math.min(broadcast.dmCount, Math.floor((Date.now() - startedAt) / MOCK_SEND_MS));
  const done = sentCount === broadcast.dmCount;
  return {
    ...broadcast,
    sentCount,
    status: done ? 'sent' : 'sending',
    completedAt: done ? new Date(startedAt + broadcast.dmCount * MOCK_SEND_MS).toISOString() : null
  };
}

function listBroadcasts(context: Context): Result {
  requireAdmin(context);
  const list: BroadcastList = { items: outbox.slice(0, 20).map(progressed), ...audience() };
  return ok(list);
}

function sendBroadcast(context: Context): Result {
  requireAdmin(context);
  const parsed = createBroadcastSchema.safeParse(context.body);
  if (!parsed.success) throw validationError(parsed.error.issues);

  const { audience: recipientCount, dmAudience: dmCount } = audience();
  const broadcast: Broadcast = {
    id: objectId(`broadcast:${outbox.length}`),
    message: parsed.data.message,
    status: 'sending',
    recipientCount,
    dmCount,
    sentCount: 0,
    failedCount: 0,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  outbox = [{ broadcast, startedAt: Date.now() }, ...outbox];
  return { status: 202, data: broadcast };
}
```

- In the route table, add:

```ts
  { method: 'GET', path: '/admin/broadcasts', handle: listBroadcasts },
  { method: 'POST', path: '/admin/broadcasts', handle: sendBroadcast },
```

The old `features/admin/BroadcastPage.tsx` still compiles: it only reads `recipientCount`. It's rewritten in Task 11.

- [ ] **Step 6: Typecheck and verify**

Run: `pnpm typecheck`. Expected: PASS.

Verify against a local API with Mongo (`pnpm --filter @bookquest/api dev`) and an admin token in `$TOKEN`:

```bash
curl -s -X POST localhost:4000/api/v1/admin/broadcasts -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"message":"Test"}' -w '\n%{http_code}\n'
curl -s localhost:4000/api/v1/admin/broadcasts -H "Authorization: Bearer $TOKEN" | head -c 600
```

Use the port from the repo-root `.env`, not necessarily 4000. Expected:
- The first call answers `202` within about a second, with `"status":"sending"`.
- The list shows it, and its `sentCount` rises on repeated calls until `"status":"sent"`.

**Old rows (Review Focus 3):** a broadcast created before this change lists as `"status":"sent"`. Restart the API while a send is running: after the restart that row reads `"interrupted"`, and the old rows are still `"sent"`.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/schemas/notification.ts apps/api/src apps/web/src/lib/api/mock/routes.ts
git commit -m "feat(api): deliver broadcasts in the background with progress, list history, sweep interrupted sends

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Broadcast screen — composer, preview, confirmation, history

**Files:**
- Move: `features/admin/BroadcastPage.tsx` → `features/admin/broadcast/BroadcastPage.tsx` (rewrite)
- Create: `broadcast/suggestions.ts`, `broadcast/components/MessagePreview.tsx`, `broadcast/components/BroadcastHistory.tsx`, `api/useBroadcasts.ts`
- Modify: `api/adminKeys.ts`, `api/useSendBroadcast.ts`, `apps/web/src/app/router.tsx`

**Interfaces:**
- Consumes: `BroadcastList`, `BROADCAST_MAX_LENGTH` (Task 10); `TextArea`, `Sheet` (Task 1); `AdminQuery`, `AdminPageHeader` (Task 2).
- Produces:
  - `adminKeys.broadcasts()`
  - `useBroadcasts()`
  - `interface Suggestion { label: string; message: string }`
  - `broadcastSuggestions(quest: Quest, now: Date): Suggestion[]`, also used by the Dashboard in Task 12
  - `interface BroadcastLocationState { draft?: string }`, the router-state contract for pre-filled drafts

- [ ] **Step 1: Queries**

`api/adminKeys.ts`, add: `broadcasts: () => [...adminKeys.all, 'broadcasts'] as const,`

`api/useBroadcasts.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { BroadcastList } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

const POLL_MS = 2000;

export function useBroadcasts() {
  return useQuery({
    queryKey: adminKeys.broadcasts(),
    queryFn: () => api.get<BroadcastList>('/admin/broadcasts'),
    // Poll only while a delivery is running; an idle outbox costs nothing.
    refetchInterval: (query) => (query.state.data?.items.some((item) => item.status === 'sending') ? POLL_MS : false)
  });
}
```

`api/useSendBroadcast.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Broadcast, CreateBroadcastPayload } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

export function useSendBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBroadcastPayload) => api.post<Broadcast>('/admin/broadcasts', payload),
    // The new row arrives as "sending", which switches the history's polling on.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.broadcasts() })
  });
}
```

- [ ] **Step 2: Suggestions**

`broadcast/suggestions.ts`:

```ts
import type { Quest } from '@bookquest/shared';
import { formatLongDate } from '@/lib/format';

export interface Suggestion {
  label: string;
  message: string;
}

const DAY_MS = 86_400_000;

/** Starting points from the quest's own dates, so the facts in a broadcast are never retyped by hand. */
export function broadcastSuggestions(quest: Quest, now: Date): Suggestion[] {
  const { title, author } = quest.book;

  switch (quest.phase) {
    case 'upcoming':
      return [
        {
          label: 'Announce the opening',
          message: `BookQuest ${quest.year} opens on ${formatLongDate(quest.opensAt)}. This year's book is ${title} by ${author}. Open BookQuest to join!`
        }
      ];
    case 'reading': {
      const days = Math.max(0, Math.ceil((Date.parse(quest.readingDeadline) - now.getTime()) / DAY_MS));
      return [
        {
          label: 'Remind readers',
          message: `${days} ${days === 1 ? 'day' : 'days'} left to finish ${title}. The quiz opens ${formatLongDate(quest.quizOpensAt)}.`
        },
        {
          label: 'Quiz dates',
          message: `Mark your calendar: the quiz opens ${formatLongDate(quest.quizOpensAt)} and closes ${formatLongDate(quest.quizClosesAt)}. One attempt, so pick your moment!`
        }
      ];
    }
    case 'quiz':
      return [
        {
          label: 'Quiz is open',
          message: `The quiz is open until ${formatLongDate(quest.quizClosesAt)}. One attempt. Good luck!`
        }
      ];
    case 'finished':
      return now.getTime() < Date.parse(quest.resultsAt)
        ? [{ label: 'Results date', message: `The quiz has closed. Results are published ${formatLongDate(quest.resultsAt)}.` }]
        : [{ label: 'Results are out', message: `Results for ${title} are out! Open BookQuest to see where you placed.` }];
  }
}
```

- [ ] **Step 3: `MessagePreview` and `BroadcastHistory`**

`broadcast/components/MessagePreview.tsx`:

```tsx
/** Telegram's own dark-theme bubble colours, on purpose: this previews how the DM will look there, not in BookQuest. */
export function MessagePreview({ message }: { message: string }) {
  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="type-label">In Telegram</figcaption>
      <div className="max-w-[22rem] self-start rounded-2xl rounded-bl-md bg-[#182533] px-3 py-2 text-[#f5f5f5]">
        <p className="m-0 text-sm font-semibold text-[#6ab3f3]">BookQuest</p>
        <p className="m-0 whitespace-pre-wrap break-words text-[0.95rem] leading-snug">{message}</p>
      </div>
    </figure>
  );
}
```

`broadcast/components/BroadcastHistory.tsx`:

```tsx
import type { Broadcast, BroadcastList } from '@bookquest/shared';
import { formatCount, formatLongDate } from '@/lib/format';
import { AdminQuery } from '../../components/AdminQuery';

type HistoryQuery = Parameters<typeof AdminQuery<BroadcastList>>[0]['query'];

const TONE: Record<Broadcast['status'], string> = {
  sending: 'text-amber',
  sent: 'text-taupe',
  interrupted: 'text-error'
};

function statusText(broadcast: Broadcast): string {
  const telegram =
    broadcast.dmCount > 0 ? ` · ${formatCount(broadcast.sentCount)} of ${formatCount(broadcast.dmCount)} on Telegram` : '';
  switch (broadcast.status) {
    case 'sending':
      return `Sending${telegram}`;
    case 'sent':
      return `Reached ${formatCount(broadcast.recipientCount)}${telegram}`;
    case 'interrupted':
      return `Interrupted${telegram}`;
  }
}

export function BroadcastHistory({ query }: { query: HistoryQuery }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-label m-0">Sent</h2>
      <AdminQuery query={query} loadingLabel="Opening the outbox…">
        {(list) =>
          list.items.length === 0 ? (
            <p className="m-0 text-sm text-taupe">Nothing sent yet.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-[color:var(--rule)] p-0">
              {list.items.map((broadcast) => (
                <li key={broadcast.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm text-taupe-dim">{formatLongDate(broadcast.createdAt)}</span>
                    <span className={`text-sm ${TONE[broadcast.status]}`}>{statusText(broadcast)}</span>
                  </div>
                  <p className="m-0 line-clamp-3 whitespace-pre-wrap text-paper-dim">{broadcast.message}</p>
                </li>
              ))}
            </ul>
          )
        }
      </AdminQuery>
    </section>
  );
}
```

If `Parameters<typeof AdminQuery<BroadcastList>>` isn't accepted by the TS version in use (instantiation expressions need TS ≥ 4.7, so it should be), use `ReturnType<typeof useBroadcasts>` from `../../api/useBroadcasts` instead.

- [ ] **Step 4: `BroadcastPage`**

```bash
git mv apps/web/src/features/admin/BroadcastPage.tsx apps/web/src/features/admin/broadcast/BroadcastPage.tsx
```

Replace its contents with:

```tsx
import { useState } from 'react';
import { useLocation } from 'react-router';
import { BROADCAST_MAX_LENGTH } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useCurrentQuest } from '@/lib/api/quest';
import { formatCount } from '@/lib/format';
import { useUiStore } from '@/stores/ui.store';
import { useBroadcasts } from '../api/useBroadcasts';
import { useSendBroadcast } from '../api/useSendBroadcast';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { BroadcastHistory } from './components/BroadcastHistory';
import { MessagePreview } from './components/MessagePreview';
import { broadcastSuggestions } from './suggestions';

/** Router state other screens hand over to pre-fill the composer (the Dashboard's next steps). */
export interface BroadcastLocationState {
  draft?: string;
}

export function BroadcastPage() {
  const location = useLocation();
  const [message, setMessage] = useState(() => (location.state as BroadcastLocationState | null)?.draft ?? '');
  const [confirming, setConfirming] = useState(false);
  const broadcasts = useBroadcasts();
  const quest = useCurrentQuest();
  const send = useSendBroadcast();
  const showToast = useUiStore((state) => state.showToast);

  const trimmed = message.trim();
  const suggestions = quest.data ? broadcastSuggestions(quest.data, new Date()) : [];
  const reach = broadcasts.data;
  const nearLimit = message.length >= BROADCAST_MAX_LENGTH * 0.9;

  function confirmSend() {
    send.mutate(
      { message: trimmed },
      {
        onSuccess: () => {
          setMessage('');
          showToast('Broadcast on its way.');
        },
        onSettled: () => setConfirming(false)
      }
    );
  }

  return (
    <AdminScreen className="max-w-3xl">
      <AdminPageHeader eyebrow="Broadcast" title="Message everyone" />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) setConfirming(true);
        }}
        className="flex flex-col gap-4"
      >
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => setMessage(suggestion.message)}
                className="min-h-9 rounded-chip border border-[color:var(--rule)] px-3 text-sm text-paper-dim transition-colors hover:border-[color:var(--color-ember)] hover:text-paper"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        <TextArea
          label="Message"
          rows={5}
          maxLength={BROADCAST_MAX_LENGTH}
          placeholder="The quiz opens tomorrow at 18:00."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          head={
            <span className={`text-xs tabular-nums ${nearLimit ? 'text-error' : 'text-taupe-dim'}`}>
              {formatCount(message.length)} / {formatCount(BROADCAST_MAX_LENGTH)}
            </span>
          }
          status={send.isError ? 'bad' : undefined}
          message={send.isError ? send.error.message : undefined}
        />

        {trimmed && <MessagePreview message={trimmed} />}

        {reach && (
          <p className="m-0 text-sm text-taupe">
            Reaches {formatCount(reach.audience)} people · {formatCount(reach.dmAudience)} on Telegram
          </p>
        )}

        <Button type="submit" disabled={!trimmed || send.isPending} className="self-stretch sm:self-start">
          Send to everyone
        </Button>
      </form>

      <BroadcastHistory query={broadcasts} />

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Send this to everyone?"
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmSend} disabled={send.isPending}>
              {send.isPending ? 'Sending…' : 'Send now'}
            </Button>
          </>
        }
      >
        <MessagePreview message={trimmed} />
        {reach && (
          <p className="m-0 text-sm text-taupe">
            It reaches {formatCount(reach.audience)} people in the app, {formatCount(reach.dmAudience)} of them on
            Telegram too. It can't be unsent.
          </p>
        )}
      </Sheet>
    </AdminScreen>
  );
}
```

In `apps/web/src/app/router.tsx`, change the import to `@/features/admin/broadcast/BroadcastPage`.

- [ ] **Step 5: Typecheck and manual check**

Run: `pnpm typecheck`. Expected: PASS.

Manual check at 390px, `/admin/broadcast`, mock API:
1. Suggestion chips match the phase ("Remind readers", "Quiz dates"). Tapping one fills the message, and the Telegram-style bubble preview appears.
2. The counter reads `n / 1,000` and turns orange from 900. Pasting 1,200 characters stops at 1,000.
3. The line "Reaches N people · M on Telegram" shows.
4. Send → sheet → "Send now". The toast appears, the composer clears, and the new history row reads "Sending · 12 of M on Telegram" and counts up. The Network tab shows `GET /admin/broadcasts` every 2s until the row reads "Reached N · M of M on Telegram", then polling stops.
5. Quickly double-tapping "Send now" sends only one request (the button is disabled while pending).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/router.tsx apps/web/src/features/admin
git commit -m "feat(web): broadcast composer with suggestions, Telegram preview, confirmation and live history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase E · Dashboard & roster

### Task 12: Dashboard as a next-steps hub

**Files:**
- Rewrite: `apps/web/src/features/admin/DashboardPage.tsx`

**Interfaces:**
- Consumes: `AdminQuery`, `AdminPageHeader`, `PHASE_LABEL`, `nextMilestone` (Task 2); `QuestTimeline` (Task 5); `questDates` (Task 3); `broadcastSuggestions` and `BroadcastLocationState` (Task 11); `useCountdown` (existing).
- Produces: nothing new.

- [ ] **Step 1: Rewrite `DashboardPage.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Quest } from '@bookquest/shared';
import { useCurrentQuest } from '@/lib/api/quest';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCount, formatLongDate } from '@/lib/format';
import { useAdminStats } from './api/useAdminStats';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';
import { QuestTimeline } from './components/QuestTimeline';
import { PHASE_LABEL, nextMilestone, type Milestone } from './phase';
import { questDates } from './dates';
import { broadcastSuggestions } from './broadcast/suggestions';
import type { BroadcastLocationState } from './broadcast/BroadcastPage';

/** `/admin` — where the quest stands and the one or two things worth doing about it. */
export function DashboardPage() {
  const quest = useCurrentQuest();

  return (
    <AdminQuery
      query={quest}
      loadingLabel="Reading the register…"
      notFound={(error) => (
        <EmptyState
          title={error.message}
          body="Nothing is running between editions. Set up the next one when you're ready."
          action={<Button to="/admin/quest/new">Start next edition</Button>}
          className="flex-1"
        />
      )}
    >
      {(data) => <Dashboard quest={data} />}
    </AdminQuery>
  );
}

function Dashboard({ quest }: { quest: Quest }) {
  const stats = useAdminStats();
  const [now] = useState(() => new Date());
  const milestone = nextMilestone(quest, now);
  const count = (value: number | undefined) => (value === undefined ? '—' : formatCount(value));

  return (
    <AdminScreen>
      <AdminPageHeader
        eyebrow={`Edition ${quest.edition}`}
        title={quest.book.title}
        actions={
          <span className="type-label rounded-chip border border-[color:var(--rule-strong)] px-2 py-1 text-paper-dim">
            {PHASE_LABEL[quest.phase]}
          </span>
        }
      />

      {milestone && <MilestoneLine milestone={milestone} />}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Participants" value={count(stats.data?.participants)} />
        <StatCard label="Joined today" value={count(stats.data?.registeredToday)} />
        <StatCard label="Quiz submitted" value={count(stats.data?.quizSubmitted)} />
      </div>

      <NextSteps quest={quest} now={now} />

      <section className="flex flex-col gap-2">
        <h2 className="type-label m-0">Schedule</h2>
        <QuestTimeline
          dates={questDates(quest)}
          now={now}
          renderValue={(field) => <span className="text-paper-dim">{formatLongDate(quest[field])}</span>}
        />
      </section>
    </AdminScreen>
  );
}

function MilestoneLine({ milestone }: { milestone: Milestone }) {
  // Memoised on the ISO string: a fresh Date each render would restart useCountdown's tick.
  const target = useMemo(() => new Date(milestone.at), [milestone.at]);
  const { days } = useCountdown(target);
  const when = days === 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`;

  return (
    <p className="m-0 text-paper">
      {milestone.label} {when}
      <span className="text-taupe"> · {formatLongDate(milestone.at)}</span>
    </p>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-box border border-[color:var(--rule)] bg-[color:var(--color-ash)] px-3 py-3">
      <p className="type-label m-0">{label}</p>
      <p className="type-display m-0 tabular-nums text-2xl text-paper">{value}</p>
    </div>
  );
}

/** Phase-aware actions only — the tab bar already covers plain navigation. */
function NextSteps({ quest, now }: { quest: Quest; now: Date }) {
  const navigate = useNavigate();
  const [suggestion] = broadcastSuggestions(quest, now);
  const draft = (message: string) =>
    navigate('/admin/broadcast', { state: { draft: message } satisfies BroadcastLocationState });

  let content;
  switch (quest.phase) {
    case 'upcoming':
    case 'reading':
      content = suggestion && <Button onClick={() => draft(suggestion.message)}>{suggestion.label}</Button>;
      break;
    case 'quiz':
      content = (
        <p className="m-0 text-sm text-taupe">The quiz is open. Results go out {formatLongDate(quest.resultsAt)}.</p>
      );
      break;
    case 'finished':
      content = (
        <>
          <Button to="/admin/quest/new">Start next edition</Button>
          <Button to="/admin/results" variant="quiet">
            View results
          </Button>
        </>
      );
      break;
  }

  return (
    <section className="flex flex-col gap-3 rounded-box border border-[color:var(--rule)] p-4">
      <h2 className="type-label m-0">What's next</h2>
      <div className="flex flex-wrap items-center gap-3">{content}</div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck and manual check**

Run: `pnpm typecheck`. Expected: PASS.

Manual check at 390px, `/admin`:
1. The header shows the book title with the eyebrow "Edition N" and a "Reading" chip. The milestone reads "Reading ends in N days · …".
2. The three stat cards fit on one row without horizontal scroll (labels may wrap).
3. "What's next" has "Remind readers". Tapping it opens Broadcast with the message pre-filled.
4. The schedule rail shows passed and future dates with a "Now" marker.
5. Run `mockApi.setQuestRunning(false)` and reload: the empty state shows "Start next edition". Run `mockApi.setPhase('finished')` with the quest running: "What's next" offers "Start next edition" and "View results". `mockApi.reset()` restores the fixtures.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/admin/DashboardPage.tsx
git commit -m "feat(web): dashboard with milestone, schedule and phase-aware next steps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Participants — search in the URL, Load more, contact actions

**Files:**
- Modify: `apps/api/src/services/admin.services.ts`, `apps/api/src/validators/admin.validators.ts`
- Modify: `apps/web/src/lib/api/mock/routes.ts`
- Modify: `apps/web/src/features/admin/api/adminKeys.ts`, `api/useAdminParticipants.ts`, `components/ParticipantsTable.tsx`
- Create: `apps/web/src/features/admin/components/ContactLink.tsx`
- Rewrite: `apps/web/src/features/admin/ParticipantsPage.tsx`
- Delete: `apps/web/src/features/admin/components/ParticipantsPager.tsx`

**Interfaces:**
- Consumes: `SearchInput` and `openTelegramLink` (Task 1), `AdminQuery` and `AdminPageHeader` (Task 2).
- Produces:
  - `adminKeys.participants(params: { q: string; limit: number })`
  - `useAdminParticipants({ q, limit })`, an infinite query
  - `ContactLink({ contact: Participant['contact'] })`

- [ ] **Step 1: API and mock search by contact**

In `apps/api/src/services/admin.services.ts`, inside `listParticipants`, change the `$or` to:

```ts
    filter.$or = [
      { fullName: { $regex: escapeRegex(term), $options: 'i' } },
      { 'contact.value': { $regex: escapeRegex(term), $options: 'i' } },
      ...(Number.isInteger(asNumber) ? [{ number: asNumber }] : [])
    ];
```

In `admin.validators.ts`, change the comment on `q` to `/** Matched against name, number or contact. */`.

In `apps/web/src/lib/api/mock/routes.ts`, inside `adminParticipants`, change the filter to:

```ts
    ? all.filter(
        (entry) =>
          entry.fullName.toLowerCase().includes(term) ||
          entry.contact.value.toLowerCase().includes(term) ||
          String(entry.number) === term
      )
```

- [ ] **Step 2: Infinite query**

`api/adminKeys.ts`: change `participants` to:

```ts
  participants: (params: { q: string; limit: number }) => [...adminKeys.all, 'participants', params] as const,
```

Replace `api/useAdminParticipants.ts` with:

```ts
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { Paginated, Participant } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

/**
 * Pages through `GET /admin/participants` (page/limit/total) as one growing
 * list — "Load more" works the same on a phone as a laptop. `keepPreviousData`
 * keeps the old rows up while a new search loads.
 */
export function useAdminParticipants({ q, limit }: { q: string; limit: number }) {
  return useInfiniteQuery({
    queryKey: adminKeys.participants({ q, limit }),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: String(limit) });
      if (q) params.set('q', q);
      return api.get<Paginated<Participant>>(`/admin/participants?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData
  });
}
```

- [ ] **Step 3: `ContactLink`, then use it in the table**

`components/ContactLink.tsx`:

```tsx
import { Copy } from 'lucide-react';
import type { Participant } from '@bookquest/shared';
import { openTelegramLink } from '@/lib/telegram';
import { useUiStore } from '@/stores/ui.store';

type Contact = Participant['contact'];

function contactHref(contact: Contact): string {
  return contact.method === 'telegram'
    ? `https://t.me/${contact.value.replace(/^@/, '')}`
    : `tel:${contact.value.replace(/[^\d+]/g, '')}`;
}

/** Reaching someone is why this screen exists: one tap opens the chat or dials, one more copies. */
export function ContactLink({ contact }: { contact: Contact }) {
  const showToast = useUiStore((state) => state.showToast);
  const href = contactHref(contact);

  async function copy() {
    try {
      await navigator.clipboard.writeText(contact.value);
      showToast('Copied.');
    } catch {
      showToast("Couldn't copy. Long-press the contact to select it.");
    }
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <a
        href={href}
        target={contact.method === 'telegram' ? '_blank' : undefined}
        rel="noreferrer"
        onClick={(event) => {
          // Inside the Mini App a t.me link should open the chat in Telegram, not a browser.
          if (contact.method === 'telegram' && openTelegramLink(href)) event.preventDefault();
        }}
        className="min-w-0 truncate text-paper-dim underline decoration-[color:var(--rule-strong)] underline-offset-4 hover:text-paper"
      >
        <span className="type-label mr-1">{contact.method}</span>
        {contact.value}
      </a>
      <button
        type="button"
        aria-label={`Copy ${contact.value}`}
        onClick={() => void copy()}
        className="grid h-9 w-9 shrink-0 place-items-center text-taupe hover:text-paper"
      >
        <Copy aria-hidden className="h-4 w-4" />
      </button>
    </span>
  );
}
```

In `components/ParticipantsTable.tsx`, add `import { ContactLink } from './ContactLink';`, then:
- Replace the card's contact `<p>` with `<ContactLink contact={participant.contact} />`.
- Replace the table cell's contents (`<span className="type-label mr-1">…</span>{participant.contact.value}`) with `<ContactLink contact={participant.contact} />`.

- [ ] **Step 4: Rewrite `ParticipantsPage.tsx`, delete the pager**

```bash
git rm apps/web/src/features/admin/components/ParticipantsPager.tsx
```

```tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Paginated, Participant } from '@bookquest/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatCount } from '@/lib/format';
import { useAdminParticipants } from './api/useAdminParticipants';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';
import { ParticipantsTable } from './components/ParticipantsTable';

const LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 350;

/** `/admin/participants` — the roster with contact, which is why this endpoint is admin-only. */
export function ParticipantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const query = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const participants = useAdminParticipants({ q: query, limit: LIMIT });

  // In the URL so a refresh, a shared link or Back keeps the search.
  useEffect(() => {
    setSearchParams(query ? { q: query } : {}, { replace: true });
  }, [query, setSearchParams]);

  return (
    <AdminScreen className="max-w-4xl">
      <AdminPageHeader eyebrow="Participants" title="The roster" />
      <SearchInput
        aria-label="Search participants"
        placeholder="Name, number or contact"
        value={searchInput}
        onChange={setSearchInput}
        className="max-w-sm"
      />
      <AdminQuery query={participants} loadingLabel="Counting the roster…">
        {(data) => (
          <Roster
            data={data}
            hasQuery={query.length > 0}
            hasMore={participants.hasNextPage}
            isLoadingMore={participants.isFetchingNextPage}
            onLoadMore={() => void participants.fetchNextPage()}
          />
        )}
      </AdminQuery>
    </AdminScreen>
  );
}

interface RosterProps {
  data: InfiniteData<Paginated<Participant>>;
  hasQuery: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

function Roster({ data, hasQuery, hasMore, isLoadingMore, onLoadMore }: RosterProps) {
  const items = data.pages.flatMap((page) => page.items);
  const total = data.pages[0]?.total ?? 0;

  if (items.length === 0) {
    return hasQuery ? (
      <EmptyState title="No one matches that search" titleAs="h2" body="Try a different name, number or contact." className="flex-1" />
    ) : (
      <EmptyState title="No one has registered yet" titleAs="h2" className="flex-1" />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="m-0 text-sm text-taupe">
        {formatCount(total)} {hasQuery ? 'found' : 'registered'}
      </p>
      <ParticipantsTable participants={items} />
      {hasMore && (
        <Button variant="quiet" onClick={onLoadMore} disabled={isLoadingMore} className="self-center">
          {isLoadingMore ? 'Loading…' : `Show more · ${formatCount(total - items.length)} left`}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck and manual check**

Run: `pnpm typecheck`. Expected: PASS.

Manual check at 390px, `/admin/participants`:
1. Type part of a Telegram handle. The results filter and the URL gains `?q=…` (replace, not push). Refresh: the search and results come back.
2. With more than 50 participants in the mock, "Show more · N left" appends rows and then disappears.
3. Tap a Telegram contact. On the web it opens t.me in a new tab; inside the Mini App it opens the chat. Tap a phone contact: `tel:` opens the dialler.
4. Tap the copy icon: the toast "Copied.".
5. At 1280px the table shows the same `ContactLink`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/admin.services.ts apps/api/src/validators/admin.validators.ts \
  apps/web/src/lib/api/mock/routes.ts apps/web/src/features/admin
git commit -m "feat: roster search by contact, search in the URL, load more, tap-to-contact and copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase F · Wrap-up

### Task 14: Docs and a full walkthrough

**Files:**
- Modify: `docs/FRONTEND-SPEC.md` (route table near line 150)
- Modify: `docs/BACKEND-SPEC.md` (admin endpoints)

- [ ] **Step 1: Route table**

In `docs/FRONTEND-SPEC.md`, after the `| /admin/results | … |` row, add:

```
| `/admin/broadcast` | Broadcast composer + sent history | admin | Background delivery, polls while sending. |
| `/admin/quest/new` | Start the next edition | admin | Only once the current quest is `finished`. |
```

- [ ] **Step 2: Backend spec**

In `docs/BACKEND-SPEC.md`, find the admin endpoint section (`grep -n "admin/quests\|admin/broadcasts" docs/BACKEND-SPEC.md`) and record:
- `POST /api/v1/admin/quests` accepts `makeCurrent: boolean` (default `false`). When `true`, the new quest becomes current in the same transaction.
- `POST /api/v1/admin/broadcasts` answers **202** with `status: "sending"`. Telegram DMs are delivered after the response.
- `GET /api/v1/admin/broadcasts` → `{ items: Broadcast[] (latest 20), audience, dmAudience }`.
- On boot, `sending` broadcasts are marked `interrupted`.

- [ ] **Step 3: Full check**

```bash
pnpm typecheck && pnpm build
grep -rn "E9976A\|B2532A" apps/web/src
grep -rn "useTelegramBackButton" apps/web/src/features/admin
```

Expected:
- typecheck and build pass,
- the first grep prints nothing,
- the second grep prints only `quest/NewEditionPage.tsx`.

Walk through every tab at 390×844 and 1280×800 with the mock API. Confirm:
- no horizontal page scroll,
- the save bar never covers the last field,
- sheets close with Esc and on a backdrop tap,
- the toast shows above the tab bar.

- [ ] **Step 4: Commit**

```bash
git add docs/FRONTEND-SPEC.md docs/BACKEND-SPEC.md
git commit -m "docs: admin routes, makeCurrent and background broadcasts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
