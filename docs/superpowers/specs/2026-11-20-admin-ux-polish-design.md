# Admin UX polish — Design

**Goal:** the admin site feels calm and fast on a laptop. Every section is one click away, dropdowns
are designed instead of native, forms don't shout before you've typed, and the quiz editor and broadcast drop the clutter.

Covers TODO items: laptop navbar, custom dropdowns everywhere (incl. the quest editor's quiz picker),
white date icon, calmer validation + creative placeholders, scroll to new question, no reorder arrows, no per-question time in
the list, no "Announce the opening", and the broadcast history as a table.

**Anti-goals:**
- A custom dropdown that's worse than native: no keyboard support, clipped by a scroll container, or unusable on a phone.
- Validation so quiet that saving fails with no clue why.
- Phone admin getting worse while laptop admin gets better.

---

## 1. Laptop navbar

`AdminLayout` today: four primary tabs plus "More" (results, certificates, broadcast, messages) in a bottom bar.

- **≥1024px (`lg`):** the bottom bar shows **all eight** destinations inline and the More button is hidden. They
  fit easily at that width, and the labels stay.
- **<1024px:** unchanged (four plus More).
- One `ALL_TABS` list with a `primary: boolean` flag replaces the two arrays, so nothing is listed twice.

## 2. One custom `Select`, used everywhere

There's a single `components/ui/Select.tsx` (native `<select>` in `Field` styling), used by the interaction filters,
the resource kind picker, the quest editor's **quiz section** (two selects) and the live-quiz filters. Rebuild **its
internals** and keep its props (`label`, `value`, `options`, `onChange`, `className`, `disabled`), so every caller is
upgraded at once.

- **Trigger:** same look as `Field` (height per `useFieldSize`), the current label, a chevron that rotates when open.
- **Popover:** anchored under the trigger, matches the trigger width (min 12rem), max height 18rem with scroll,
  `ash` surface, soft shadow, 150ms fade and slide. It's rendered in a **portal** with fixed positioning that flips up when
  there's no room below, so a sheet or table never clips it.
- **Options:** a check on the selected one, a hover/active highlight, and an optional `hint` line per option (the quiz picker
  uses it for "12 questions · draft").
- **Keyboard (WAI-ARIA listbox):** Enter/Space/↓ opens, ↑/↓ moves, Home/End, type-ahead by first letter, Enter
  selects, Esc closes and returns focus to the trigger. `role="combobox"` / `listbox` / `option`,
  `aria-activedescendant`.
- **Phones (<640px):** the same popover. On a phone a native picker is fine, but the request is custom everywhere and a
  portal popover works on touch.
- Outside click and scroll close it.

No new dependency: `@floating-ui` isn't installed, and the positioning needed is a small hook
(`useAnchoredPosition`).

## 3. Date inputs

`DateTimelineField` uses `type="datetime-local"`. Set `color-scheme: dark` on admin date inputs (in `base.css`,
scoped to `input[type='datetime-local'], input[type='date']`) so the browser draws a light calendar icon, and add
`::-webkit-calendar-picker-indicator { filter: invert(1); opacity: .8; cursor: pointer }` for WebKit.

## 4. Calm forms

The quest editor, new edition and quiz editor all use `react-hook-form` with `mode: 'onChange'`, and the quiz list shows
live amber "issues".

- **Rule:** no field shows an error until the form has had a **save attempt** (`formState.isSubmitted`). After
  that, errors update live as the admin fixes them.
- `useForm({ mode: 'onSubmit', reValidateMode: 'onChange' })` on all three forms.
- Quiz question issues (`issuesFor`) and the per-row warning icon only show after a save attempt. **Exception:** a
  question that was already saved and is broken (it came from the server with issues) still shows them, because that's information,
  not nagging. The rule: show when `isSubmitted || !question.isNew`. Questions created in this session carry a client-only
  `isNew` flag.
- `NewQuizSheet`: the error shows only after a submit attempt (today it's already submit-only, so keep it).
- The save bar still says "N things to fix" after an attempt, so the reason is never hidden.

**Creative placeholders** for every text input in the quest editor, quiz editor and new quiz sheet, e.g.:
- Quiz title: "e.g. Ikki eshik orasi — final round"
- Question: "Who opens the second door, and why?"
- Option: "Type an answer…"
- Book title / author / pages: "O‘tkan kunlar", "Abdulla Qodiriy", "320"
- Prize: "Kindle Paperwhite + a signed copy"
- Broadcast: "Tonight at 20:00 the quiz opens. Have your book nearby…"
They're written per language (uz placeholders in Uzbek, and so on).

## 5. Quiz editor (`/admin/quizzes/:id`)

- **Add question → smooth scroll:** after `append`, scroll the new question card into view
  (`scrollIntoView({ behavior: 'smooth', block: 'center' })` on the next frame) and focus its text field.
  Reduced motion → `behavior: 'auto'`.
- **Remove the ↑/↓ arrow buttons** on question rows. Drag-and-drop (dnd-kit) stays the way to reorder.
  Keyboard reordering is still possible through dnd-kit's keyboard sensor. Make sure it's enabled, since it replaces the arrows for
  accessibility.
- **Remove the per-question time** (`{seconds}s`) from the collapsed row. It stays editable inside the open question.

## 6. Broadcast

- **Remove "Announce the opening"**, the `upcoming` suggestion in `suggestions.ts`. In `upcoming` the
  suggestions list is empty and the section hides itself (check that it does).
- **History as a table** (≥640px). Columns: **Sent** (date and time) · **Message** (one line, ellipsis, expands on
  click) · **Telegram** (`2/2`, `sentCount/dmCount`, tabular numbers, green when equal, amber when lower) · **Status** (a small chip:
  Sending / Sent / Interrupted). On phones each row becomes a compact two-line card with the same chips.
- Drop the long "Reached N … on Telegram" sentences. A `title` tooltip on the `2/2` keeps the full meaning
  ("2 of 2 Telegram messages delivered").

---

## Out of scope
- A date-picker rebuild (only the icon colour changes).
- Bulk broadcast actions or resend.

## i18n
`en`/`uz`/`ru`: placeholders, table headers, status chips, the tooltip, and the removal of the `announce*` keys.
