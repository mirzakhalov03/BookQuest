# BookQuest — Frontend Specification

> Scope: `apps/web`. Paired with `BACKEND-SPEC.md`; the API contract at the end of this document is
> byte-identical in both. Implementation order is in `FRONTEND-PLAN.md`.

---

## 1. Audit — what exists today

`apps/web` is a working Vite + React + Tailwind shell with the design system ported in and two
route stubs. It builds and typechecks clean. Nothing here needs replacing.

### Toolchain

| | Version | Note |
|---|---|---|
| Vite | 8.2 | `envDir` points at the repo root, so one `.env` serves every workspace |
| React | 19.2 | `StrictMode` on |
| react-router | 8.3 | `createBrowserRouter`, `RouterProvider` imported from `react-router/dom` |
| TanStack Query | 5.102 | server state |
| Zustand | 5.0 | client state, `persist` middleware |
| Tailwind | 4.3 | `@tailwindcss/vite` plugin, CSS-first `@theme` config — no `tailwind.config.js` |
| TypeScript | 7.0 | `baseUrl` removed by TS7; `paths` resolve relative to the tsconfig |

### File inventory

```
apps/web/
  index.html               Archivo (wdth 75–125, wght 400–700), telegram-web-app.js, theme-color
  vite.config.ts           react + tailwind plugins, repo-root envDir, @ alias, port 5173, host:true
  src/
    main.tsx               initTelegram() then createRoot
    app/
      App.tsx              Providers > RouterProvider
      providers.tsx        QueryClientProvider only
      router.tsx           / and /register under AppLayout
    layouts/AppLayout.tsx  fixed atmosphere layer + <Outlet/>
    components/ui/Button.tsx   primary | gold | quiet
    features/
      home/HomePage.tsx           STUB — title, author, raw countdown
      home/api/useCurrentQuest.ts questKeys factory + useQuery
      registration/RegisterPage.tsx  STUB — title page copy only, no form
      registration/api/useRegister.ts useMutation, writes session store, invalidates quest
    hooks/useCountdown.ts    recomputes from target each tick
    lib/api/client.ts        ApiRequestError (carries fields), request<T>, api.get/post
    lib/queryClient.ts       staleTime 30s, no retry below HTTP 500
    lib/telegram.ts          safe window.Telegram.WebApp wrapper
    stores/session.store.ts  persisted { participantNumber, fullName }
    styles/
      index.css   imports theme + base
      theme.css   @theme — the whole palette, fonts, easings, animations
      base.css    globals, .type-display, .type-label, reduced-motion
```

### Working and worth keeping

- **`lib/api/client.ts`** unwraps the envelope in exactly one place and turns `error.fields` into a
  typed property on the thrown error. Forms consume it directly. Keep.
- **`hooks/useCountdown.ts`** recomputes from the target on every tick rather than decrementing a
  stored value, so a backgrounded phone returns showing the correct time. Keep.
- **`queryClient.ts`** does not retry below HTTP 500. A 400 or 404 will not fix itself. Keep.
- **`styles/theme.css`** — every token is simultaneously a CSS variable and a Tailwind utility, so
  `--color-ember` gives `bg-ember` *and* `var(--color-ember)`. Keep.
- **Feature-first structure** (`features/<name>/` owning its own queries). Keep and extend.

### Gaps

| Gap | Consequence |
|---|---|
| `HomePage` and `RegisterPage` are stubs | The locked design exists only in `prototype/`. This is the bulk of the work. |
| No auth layer at all — no token storage, no `Authorization` header, no route guard | Cannot consume any authenticated endpoint. |
| `session.store.ts` persists `participantNumber` to `localStorage` and nothing verifies it | Client-side identity. Fine as a UI hint, must never gate anything real. |
| No loading / error / empty components | Every screen invents its own. |
| No `ErrorBoundary`, no router `errorElement` | A render error blanks the app. |
| `lib/telegram.ts` has no `MainButton`, `BackButton`, `HapticFeedback`, or `themeParams` use | Mini App feels like a website in a webview. |
| No admin area, no admin route tree | Phase 4. |
| No `.env` typing for `import.meta.env` | `VITE_API_URL` is untyped and silently `undefined` if unset. |

### Typography — Section 2's one deliberate change is **already applied**

Verified by grep: no Fraunces, no serif face anywhere in `prototype/` or `apps/web/`. Both
`--display` and `--sans` resolve to Archivo. Display type is differentiated by the **variable width
axis** (`font-stretch: 118%`, weight 600) instead of a second family — measured at 301px vs 249px
for the same string at 100px, so the axis genuinely loads rather than faux-widening.

**No further typography work is required.** It is listed here so the change is not re-done.

---

## 2. Proposed architecture

The existing shape is right for the size of this product. It gets extended, not restructured.

```
apps/web/src/
  app/
    App.tsx            providers + router
    providers.tsx      + AuthProvider  ⬜
    router.tsx         participant tree + admin tree  🚧
  layouts/
    AppLayout.tsx      atmosphere + <Outlet/> + TabBar        🚧
    AdminLayout.tsx    admin nav, distinct density            ⬜
  features/
    registration/  RegisterPage, SuccessPage, form + field components
    home/          HomePage, BookStage, Countdown, QuestAction
    book/          BookPage — description, resources           ⬜
    quests/        QuestsPage — the archive                    ⬜
    results/       ResultsPage — podium + leaderboard          ⬜
    profile/       ProfilePage — number, name, certificate     ⬜
    admin/         dashboard, participants, quest, results     ⬜
  components/
    ui/            Button, Field, Switch, Toast, Spinner, Rule
    feedback/      LoadingState, ErrorState, EmptyState        ⬜
    layout/        TabBar, TopBar, Screen                      ⬜
  hooks/           useCountdown, useTelegram, useAuth          🚧
  lib/
    api/client.ts  + Authorization header injection            🚧
    auth/          token storage, login exchange, guards       ⬜
    telegram.ts    + MainButton / BackButton / haptics         🚧
    format.ts      dates, numbers, name display                ⬜
  stores/          session.store (UI prefs only, narrowed)     🚧
  styles/          theme.css, base.css, stage.css              🚧
```

**Rules that keep it from sprawling:**

1. A feature folder owns its pages, its components, and its queries. Nothing imports from another
   feature's internals — cross-feature reuse gets promoted to `components/` or `lib/`.
2. Server state is React Query. Client state is Zustand. A value never lives in both.
3. `components/ui/` holds primitives with no product knowledge. A component that knows what a quest
   is belongs to a feature.
4. Business rules do not live here. The frontend renders `phase`; it never derives it. It renders
   `number`; it never allocates it. It renders `role`; it never grants it.

---

## 3. Routes

| Path | Screen | Access | Notes |
|---|---|---|---|
| `/` | Home — the stage | public | Content adapts to phase and registration state |
| `/register` | Registration | public | Redirects to `/` if already registered |
| `/register/success` | Number reveal | transient | Reached only from a successful mutation; direct visits redirect to `/` |
| `/book` | Book detail + resources | public | Resources may be gated to registered users — TBD-4 |
| `/quests` | Past editions | public | |
| `/quests/:edition` | One past edition | public | |
| `/results` | Podium + leaderboard | public | Empty state before `resultsAt` |
| `/me` | Profile, number, certificate | session | |
| `/quiz` | Quiz | session | **Not in this plan.** Route reserved only. |
| `/admin` | Dashboard | admin | |
| `/admin/participants` | Participant table | admin | |
| `/admin/quest` | Book, dates, prizes | admin | |
| `/admin/results` | Result inspection | admin | |
| `/admin/broadcast` | Broadcast composer + sent history | admin | Background delivery, polls while sending. |
| `/admin/quest/new` | Start the next edition | admin | Only once the current quest is `finished`. |
| `/admin/quiz` | Quiz management | admin | **Not in this plan.** |

**Route guards are UX, not security.** `<RequireAuth>` and `<RequireAdmin>` exist so people are not
shown a screen that will fail — they do not protect anything. Every admin screen's data comes from
an endpoint that independently checks the role server-side. A user who edits `role` in devtools sees
an admin shell full of `403 forbidden` errors and changes nothing.

---

## 4. Component hierarchy

### Home — `/`

```
AppLayout
└─ HomePage
   ├─ TopBar            wordmark + "Open on web ↗"
   ├─ BookStage                            ← the piece the whole design rests on
   │  ├─ Spotlight      cone + pool + breathing ring
   │  ├─ Motes          drifting particles, generated once
   │  ├─ Book3D         5 faces: cover, spine, fore-edge, top, back
   │  │  └─ BookCover   frame, sun, dune, title, author, sheen
   │  └─ Podium         top, body, cast shadow
   ├─ StageAside        title/author left · pages, quiz date, readers right (≥900px)
   ├─ Countdown
   │  ├─ CountdownLabel phase-dependent copy
   │  ├─ TimeUnit × 4   per-digit tick animation
   │  └─ DeadlineDate
   ├─ QuestAction       the one primary button + its sub-line
   └─ TabBar
```

### Registration — `/register`

```
RegisterPage
├─ EditionMark        "IV" + "Fourth annual reading competition"
├─ DisplayTitle       "Enter the quest"
├─ Lede
└─ RegistrationForm
   ├─ NameField       validates on blur, clears error on input
   ├─ ContactField
   │  └─ MethodSwitch Telegram | Phone — swaps placeholder, inputmode, live formatter
   ├─ SubmitButton
   └─ FormNote
```

### Success — `/register/success`

```
SuccessScreen
├─ Beam               vertical light sweep
├─ Hail               "You're in."
├─ NumberReveal       gold rules draw, digits set one at a time
├─ KeepNote
└─ EnterButton
```

### Reusable primitives

| Component | Responsibility |
|---|---|
| `Button` | ✅ exists. `primary` \| `gold` \| `quiet`. The only solid surface in the UI. |
| `Field` | Label, ruled input, message slot, `is-good` / `is-bad` / `is-shaking` states. |
| `Switch` | Two-option underlined tab pair. Used by the contact method; reusable for filters. |
| `TabBar` | Bottom nav. Icons + labels, safe-area padding, active indicator. |
| `Toast` | Single transient message, `role="status"`. |
| `Rule` | Hairline divider — plain or gold. |
| `LoadingState` | Never a spinner alone: label copy in the screen's own voice. |
| `ErrorState` | `error.message` verbatim plus a retry action. |
| `EmptyState` | "No quest is running right now" and friends. An invitation, not an apology. |
| `Screen` | Consistent page padding, max-width, and tab-bar clearance. |

### The 3D book — porting notes

The book is the design's centre of gravity and the easiest thing to break in a port. It is five real
CSS faces inside `transform-style: preserve-3d`, with `perspective` on the wrapper:

- The tilt is **positive** (`27deg` mobile / `29deg` desktop). Negative rotation exposes the
  fore-edge and hides the spine — the failure that made the first version read as a flat rectangle.
- The spine faces the light, so it is **brighter** than the cover, not darker. A darkening gradient
  makes it read as shadow and it disappears.
- Geometry is driven entirely by `--book-w`, `--book-h`, `--book-d`, `--book-tilt`. Every face
  positions itself from those four, so the breakpoint override is four lines.

**This stays as hand-written CSS**, in `styles/stage.css`, not Tailwind utilities. Tailwind's
arbitrary-value syntax cannot express `calc(var(--book-d) / -2)` inside a multi-part `transform`
without becoming unreadable, and the geometry is already correct. Tailwind handles layout and
spacing; the stage keeps its own stylesheet.

---

## 5. State management

| State | Owner | Why |
|---|---|---|
| Current quest, book, deadline, prizes, reader count | React Query | Server-owned, shared, cacheable, refetchable |
| Own participant record | React Query (`/participants/me`) | Server-owned; the client must not be the source of truth for its own number |
| Results, leaderboard, certificate | React Query | Server-owned |
| Session token | `lib/auth` + `localStorage` | Not React state — read synchronously before the first request |
| Registration form fields and messages | Local `useState` | Never leaves the form |
| Which view/tab is active | Router | The URL is the state |
| Toast, modal open | Zustand (`ui.store`) | Cross-tree, ephemeral |
| Contact method preference | Zustand `persist` | A UI convenience worth remembering |

**Narrowing the session store.** `session.store.ts` currently persists `participantNumber` and
`fullName`. Once `/participants/me` exists, that becomes a stale copy of server truth. Keep it only
as an **optimistic first paint** hint — the value React Query resolves always wins, and nothing is
ever gated on it.

**Query key factories.** The `questKeys` pattern already in `useCurrentQuest.ts` is the standard.
Every feature exports one, so invalidation targets are explicit:

```ts
export const participantKeys = {
  all: ['participants'] as const,
  me: () => [...participantKeys.all, 'me'] as const,
  byNumber: (n: number) => [...participantKeys.all, n] as const
};
```

---

## 6. API integration

`lib/api/client.ts` stays the only place that talks to the network. Changes:

1. **Inject `Authorization`** from the token store when a token exists.
2. **On `401`**, clear the token once and attempt a single silent re-login from `initData` before
   surfacing the error. Inside Telegram this makes expiry invisible; on the web it lands on the
   read-only state.
3. **Type `import.meta.env`** in `src/vite-env.d.ts` so a missing `VITE_API_URL` is a build error,
   not an undefined base URL.

Everything else is unchanged: one envelope unwrap, one `ApiRequestError` carrying `fields`.

**Form errors bind by field path.** The API's `error.fields` uses the same keys as the request body
(`fullName`, `contactValue`), so a mutation failure maps onto inputs with no translation layer:

```ts
onError: (error) => {
  if (error instanceof ApiRequestError) setFieldErrors(error.fields);
}
```

**Validation runs twice on purpose.** The form imports `parseFullName` / `parseTelegramUsername` /
`parsePhoneNumber` from `@bookquest/shared` for instant feedback while typing. The server runs the
same functions. The client copy is a courtesy; the server copy is the rule. They cannot drift
because they are the same code.

---

## 7. Auth and session handling

```
Mini App boot
  │
  ├─ initTelegram() → window.Telegram.WebApp.initData
  │
  ├─ POST /auth/telegram { initData }        ← the only place a session is created
  │     └─ { token, expiresAt, user }
  │
  ├─ store token (localStorage) + seed the auth query cache with `user`
  │
  └─ AuthProvider resolves → router renders
        ├─ user.participant === null → Home shows "Join BookQuest"
        └─ user.participant !== null → Home shows the phase action
```

**Web fallback (no Telegram bridge).** No `initData`, so no session. The app runs in **read-only
mode**: Home, book, past quests, results all render; registration shows a "Continue in Telegram"
affordance instead of the form. This is a deliberate, visible state, not an error — see **TBD-1**.

**Rules:**
- The token is opaque to the frontend. It is never decoded, and `role` is read from
  `/auth/me`, never from the token body.
- `role === 'admin'` only changes what is **rendered**. Authorization happens server-side, every
  request, without exception.
- No refresh-token rotation. Token lifetime is long enough (7 days) that re-running the
  `initData` exchange on `401` is simpler and equally safe inside a Mini App.

---

## 8. Design implementation mapping

The prototype is the source of truth. Every token below already exists in `theme.css`/`base.css`.

### Tokens — ported, no changes needed

| Prototype | `apps/web` | As Tailwind |
|---|---|---|
| `--void #0A0705` | `--color-void` | `bg-void` |
| `--ink #14100C` | `--color-ink` | `bg-ink` |
| `--ash #211B15` / `--ash-hi #2C241C` | `--color-ash` / `--color-ash-hi` | `bg-ash` |
| `--paper #E8DFD2` → `--taupe-dim #7E7263` | `--color-paper` … `--color-taupe-dim` | `text-paper` … |
| `--ember #E2632A`, `--ember-deep`, `--amber #F0A03C` | `--color-ember`, … | `bg-ember`, `text-amber` |
| `--gold #C8A24A`, `--gold-soft #E3C77E` | `--color-gold`, `--color-gold-soft` | `text-gold` |
| `--rule` / `--rule-strong` / `--rule-gold` | same names in `base.css` | `border-[var(--rule)]` |
| `--ease-out` / `--ease-soft` | `--ease-out-quest` / `--ease-soft` | `ease-out-quest` |
| `float`, `breathe` keyframes | `--animate-float`, `--animate-breathe` | `animate-float` |

### Type

One family, two widths — Archivo across the whole interface.

| Role | Treatment | Class |
|---|---|---|
| Display (`h1`, `h2`, book title, "You're in.") | Archivo, weight 600, `font-stretch: 118%`, `-0.03em`, `line-height 0.92` | `.type-display` |
| Countdown numerals | Archivo, `font-stretch: 108%`, tabular, fixed `0.62em` digit cells | `.type-numeral` ⬜ |
| Participant number | same numeral treatment, gold | reuse `.type-numeral` |
| Body / lede | Archivo normal width, 400 | default |
| Labels, captions, tabs | `0.6875rem`, `letter-spacing 0.16em`, uppercase | `.type-label` |

`.type-numeral` is the one addition — the fixed digit cell that stops numerals twitching as they
tick. It exists in the prototype as `.digit { width: 0.62em }`; it needs a name in the app.

### Composition

| Prototype | Becomes |
|---|---|
| `.atmos` (rules, wash, grain) | `AppLayout` background layer — ✅ partially ported |
| `.view` + `.is-on` / `.is-entering` | Router transitions; keep the same `--mid` timing and easing |
| `.stage`, `.spotlight`, `.motes`, `.book`, `.podium` | `features/home/components/` + `styles/stage.css` |
| `.clock`, `.unit`, `.digit` | `Countdown` + `TimeUnit` |
| `body[data-state="quiz"]` / `[data-state="finished"]` overrides | `data-phase={quest.phase}` on the Home root — **keep the CSS attribute-selector approach**; it is how the gold "finished" treatment cascades in one place |
| `.titlepage`, `.form`, `.field`, `.switch` | `features/registration/components/` |
| `.success__id` rule-draw + digit-set | `NumberReveal` |
| `.tabbar` / `.tab` | `components/layout/TabBar` |
| `.proto` panel | **Dropped.** It is a prototype device, not product. |

### Motion

Every animation in the prototype is already scoped to one moment: book entry, view transition,
digit tick, number reveal, spotlight breathe, mote drift. Port them as-is and add none. The
`prefers-reduced-motion` block in `base.css` covers all of them.

---

## 9. Responsive strategy

**Mobile-first, Telegram Mini App primary.** The Mini App viewport is the design target; desktop
web is the enhancement.

| Breakpoint | Behaviour |
|---|---|
| Base (< 900px) | Single column. Book `clamp(138px, 43vw, 190px)`, depth `clamp(24px, 6.5vw, 32px)`, tilt 27°. Stage asides hidden. Countdown units `flex: 1 1 0; min-width: 0` — **required**, without it the row overflows narrow viewports. |
| < 900px and < 760px tall | Reduced vertical rhythm — landscape phones and short Android webviews. |
| ≥ 880px | Registration title page goes two-column. |
| ≥ 900px | Book `clamp(210px, 16vw, 262px)`, depth `clamp(36px, 2.9vw, 46px)`, tilt 29°. Stage asides appear. Countdown units revert to `flex: 0 0 auto`. |

**Telegram specifics:**
- `viewport-fit=cover` + `env(safe-area-inset-bottom)` via `--safe-b` — ✅ already in place.
- `WebApp.expand()` on boot — ✅ already in place.
- No hover dependency. Every hover state has a touch equivalent; `:active` carries the feedback.
- Touch targets ≥ 44px. `Button` is already `min-h-[3.25rem]`.
- `BackButton` drives router navigation; `MainButton` is **not** used for the primary CTA — the
  design's own button is part of the composition and moving it to Telegram's chrome would break the
  stage. ⬜
- `themeParams` is deliberately ignored. BookQuest has a fixed dark identity; adopting Telegram's
  light theme would destroy it. Header and background colors are pushed *to* Telegram instead.

**Testing note.** Headless Chrome clamps windows to a 500px minimum width, so a "mobile" screenshot
taken by resizing the window is a lie. Render into a 390×844 iframe to see the real mobile layout.

---

## 10. Dependencies

**Current — all justified, none to remove.** React, react-dom, react-router, TanStack Query,
Zustand, Tailwind, Vite, `@bookquest/shared`.

**To add:**

| Package | Phase | Why |
|---|---|---|
| `@telegram-apps/sdk` *(optional)* | 2 | Typed Mini App bridge. **Evaluate against keeping `lib/telegram.ts`** — the hand-rolled wrapper is 40 lines and already does what is needed. Add only if `MainButton`/`BackButton`/viewport handling proves fiddly. |
| `react-error-boundary` | 2 | Small, standard. Or hand-roll — either is fine. |

**Deliberately not adding:** a form library (two fields, shared validators already return
messages), a component library (the design is the product), a date library (`Intl.DateTimeFormat`
covers it), a state library beyond Zustand, an animation library (the CSS is written and correct).

---

## 11. Static vs. backend-owned content

Keeping this line clean is what stops admin edits from requiring a deploy.

**Backend-owned — admin-editable, always fetched:**
book title, author, pages, cover, description, resources; reading deadline; quiz open/close times;
quiz question count and duration; results publication time; 1st/2nd/3rd prize; participant count;
edition and year; the derived phase.

**Frontend-owned — static, shipped in the bundle:**
all UI copy ("Enter the quest", "You're in.", "One book, one deadline, one quiz…"); nav labels;
validation messages (in `@bookquest/shared`); the cover artwork's abstract shapes; every color,
type, spacing and motion token; empty/error/loading copy; the certificate's visual design.

**The rule:** if one of two admins might want to change it during a running quest, it is backend.
If changing it is a design decision, it is frontend.

**Countdown target.** Derived from `quest.readingDeadline` (or `quizClosesAt` in the quiz phase) —
never a hardcoded date. The prototype's `2026-09-20T23:59` in `prototype/js/data.js` is mock data
and does not travel into the app.

---

## Frontend ↔ Backend API contract

> This section is **identical** in `FRONTEND-SPEC.md` and `BACKEND-SPEC.md`. Change it in both or in
> neither. `✅` = built and working today. `🚧` = exists but changes in this plan. `⬜` = not built.
>
> **Status: the backend now implements every endpoint below.** The markers record what changed
> relative to the pre-plan service, not what is missing. Frontend consumption is tracked in
> `FRONTEND-PLAN.md`.

### Conventions

- Base URL: `/api/v1`. Versioned at the router mount, so a v2 is a new mount, not a rewrite.
- All dates are **ISO-8601 UTC strings** over the wire. The client converts to `Date` at the API
  boundary; nothing downstream guesses which representation it holds.
- Auth, where required: `Authorization: Bearer <token>`.
- Every response uses one envelope:

```jsonc
// success
{ "ok": true, "data": { /* ... */ } }

// failure
{ "ok": false, "error": {
    "code": "validation_failed",
    "message": "Please enter your first and last name.",
    "fields": { "fullName": "Please enter your first and last name." }  // optional
} }
```

- `error.message` is safe to show a user verbatim — messages are written for people, not for logs.
- `error.fields` maps a field path to a message and is present only on `validation_failed`. Forms
  drop it straight onto inputs.

### Error codes → status

| `code` | Status | Meaning |
|---|---|---|
| `validation_failed` | 400 | Input rejected. Carries `fields`. |
| `unauthorized` | 401 | No session, or the session is invalid/expired. Client should re-authenticate. |
| `forbidden` | 403 | Authenticated, but not allowed. Used for admin-only routes. |
| `not_found` | 404 | No such quest, participant, or route. |
| `conflict` | 409 | Already registered; quest full; quiz already submitted. |
| `rate_limited` | 429 | Too many attempts. Carries `Retry-After`. |
| `internal_error` | 500 | Bug. Message is generic in production. |

### Shared types

Defined once in `packages/shared`, imported by both sides. Names below match the exported types.

```ts
type QuestPhase = 'upcoming' | 'reading' | 'quiz' | 'finished';
type ContactMethod = 'telegram' | 'phone';
type Role = 'participant' | 'admin';                        // ⬜ new

interface Book {                                            // 🚧 gains 3 fields
  title: string;
  author: string;
  pages: number;
  coverUrl: string | null;
  description: string | null;                               // ⬜ new — admin-editable
  resources: BookResource[];                                // ⬜ new — admin-editable
}

interface BookResource {                                    // ⬜ new
  label: string;                    // "PDF (English)", "Audiobook"
  url: string;
  kind: 'pdf' | 'epub' | 'audio' | 'link';
}

interface Prizes {                                          // ⬜ new — admin-editable
  first: string | null;             // free text: "AirPods Pro", "500,000 so'm"
  second: string | null;
  third: string | null;
}

interface Quest {                                           // 🚧 gains prizes + quiz fields
  id: string;
  edition: number;
  year: number;
  phase: QuestPhase;                // derived server-side from the clock, never stored
  book: Book;
  prizes: Prizes;                                           // ⬜ new
  opensAt: string;
  readingDeadline: string;
  quizOpensAt: string;
  quizClosesAt: string;
  resultsAt: string;
  quizQuestionCount: number | null;                         // ⬜ new — for "20 questions" copy
  quizDurationMinutes: number | null;                       // ⬜ new
  participantCount: number;
}

interface QuestSummary {                                    // ⬜ new — archive list
  id: string;
  edition: number;
  year: number;
  bookTitle: string;
  bookAuthor: string;
  coverUrl: string | null;
  participantCount: number;
  winner: { number: number; fullName: string } | null;
}

interface Contact {
  method: ContactMethod;
  value: string;                    // normalised: "@sofia_k" or "+998 90 123 45 67"
}

interface Participant {             // self-view only — includes contact
  id: string;
  number: number;                   // 4 digits, 3000–3999
  fullName: string;
  contact: Contact;
  questId: string;
  registeredAt: string;
}

interface ParticipantPublic {       // ⬜ new — everyone else's view. No contact, ever.
  number: number;
  fullName: string;
}

interface SessionUser {                                     // ⬜ new
  id: string;
  telegramUserId: string;
  firstName: string;
  username: string | null;
  photoUrl: string | null;
  role: Role;
  participant: Participant | null;  // null until they register for the current quest
}

interface ResultEntry {                                     // ⬜ new
  rank: number;
  number: number;
  fullName: string;
  score: number;                    // correct answers
  total: number;                    // questions asked
  durationMs: number;               // tiebreaker — speed counts
}

interface CertificateData {                                 // ⬜ new
  code: string;                     // short public verification code
  fullName: string;
  participantNumber: number;
  questEdition: number;
  questYear: number;
  bookTitle: string;
  bookAuthor: string;
  rank: number | null;              // null = completion certificate, not a placing
  issuedAt: string;
}
```

### Endpoints

---

#### `GET /health` ✅

Outside the versioned API. No auth. Liveness only.

`200` → `{ "ok": true, "data": { "status": "up", "uptime": 1234.5 } }`

---

#### `POST /api/v1/auth/telegram` ⬜

Exchanges Telegram-provided identity for a session. The **only** way to obtain a token.

**Auth:** none (this is the entry point).

**Body:**
```jsonc
{ "initData": "query_id=...&user=%7B...%7D&auth_date=1757000000&hash=abc..." }
```

The raw `initData` string, unparsed. Backend verifies the HMAC-SHA256 signature with a key derived
from the bot token, compares in constant time, and rejects anything whose `auth_date` is older than
`AUTH_INIT_DATA_MAX_AGE_SECONDS`.

**`200`** →
```jsonc
{ "ok": true, "data": {
    "token": "<jwt>",
    "expiresAt": "2026-09-15T10:00:00.000Z",
    "user": { /* SessionUser */ }
} }
```

**Errors:** `401 unauthorized` (bad hash, stale `auth_date`, malformed `initData`),
`429 rate_limited`, `500 internal_error`.

> **TBD-1 — resolved: read-only web.** Standalone web has no `initData`, so it can call the public
> endpoints but cannot register; the frontend must render that state rather than assume a session.
> The Telegram Login Widget (option B) remains available later and needs no contract change.

---

#### `GET /api/v1/auth/me` ⬜

Who the bearer token belongs to, re-read from the database. Never trusts claims in the token beyond
the user id.

**Auth:** required.

**`200`** → `{ "ok": true, "data": { /* SessionUser */ } }`

**Errors:** `401 unauthorized`.

---

#### `GET /api/v1/quests/current` ✅ 🚧

The Home screen's single source of truth: book, deadline, prizes, phase, reader count.

**Auth:** none. Content is public.

**`200`** → `{ "ok": true, "data": { /* Quest */ } }`

**Errors:** `404 not_found` — "No quest is running right now." The frontend renders a real empty
state for this; it is a normal condition between editions, not a failure.

**Caching:** `Cache-Control: public, max-age=30`. Client `staleTime` 30s.

> `phase` is computed per request from the clock, so a client that polls gets the transition
> without a deploy or a cron job.

---

#### `GET /api/v1/quests` ⬜

The Past Quests archive.

**Auth:** none.

**Query:** `limit` (default 20, max 50), `cursor` (opaque; omit for the first page).

**`200`** → `{ "ok": true, "data": { "items": QuestSummary[], "nextCursor": string | null } }`

Newest first. Excludes the current quest.

---

#### `GET /api/v1/quests/:edition` ⬜

One past edition. `:edition` is the integer edition number, not a database id — it is the number
people actually say out loud.

**Auth:** none.

**`200`** → `{ "ok": true, "data": { /* Quest */ } }` · **Errors:** `404 not_found`.

---

#### `POST /api/v1/participants` ✅ 🚧

Register for the current quest. Allocates the participant number.

**Auth:** 🚧 **none today — becomes required.** See TBD-1.

**Body:**
```jsonc
{
  "fullName": "  sofia   karimova ",
  "contactMethod": "telegram",
  "contactValue": "@sofia_k"
}
```

**Validation** (shared package, run identically on both sides):
- `fullName` — exactly two words, letters/hyphens/apostrophes only, no digits, each word ≥2 letters,
  rejects keyboard runs and vowel-starved strings. Normalised to title case on success.
- `contactValue` — parsed as a Telegram username or a phone number depending on `contactMethod`.
  Normalised to `@username` or a grouped `+998 90 123 45 67`.

**`201`** → `{ "ok": true, "data": { /* Participant */ } }` — the response is the **only** source of
the participant number. The frontend never computes or guesses it.

**Errors:**
- `400 validation_failed` with `fields`, keyed `fullName` / `contactValue`.
- `409 conflict` — "That contact is already registered as participant 3047." / "This year's quest is full."
- `404 not_found` — no current quest.
- `429 rate_limited`.

> **TBD-2 — resolved: registration closes at `readingDeadline`**, matching the prototype's own copy
> — *"Registration closes when the reading period ends."* A request after it is `409 conflict`,
> "Registration for this year has closed." Registering later would hand someone a number for a quiz
> they cannot reach.

---

#### `GET /api/v1/participants/me` ⬜

The caller's own registration for the current quest. Replaces client-side caching of the number as
the source of truth.

**Auth:** required.

**`200`** → `{ "ok": true, "data": { /* Participant */ } }` — includes `contact`.

**Errors:** `401 unauthorized`, `404 not_found` (authenticated but not registered — a normal state,
the frontend routes to registration).

---

#### `GET /api/v1/participants/:number` ✅ 🚧

Look up another participant.

**Auth:** 🚧 **none today — becomes required.**

**`200`** → `{ "ok": true, "data": { /* ParticipantPublic */ } }`

> 🚧 **Breaking change, and the reason for it.** This endpoint currently returns `fullName` **and**
> `contact.value` with no authentication. Numbers are sequential from 3000, so 1000 requests
> enumerate every participant's name and phone number. The response type narrows to
> `ParticipantPublic` and the route requires a session. Self-lookup moves to `/participants/me`.

**Errors:** `401 unauthorized`, `404 not_found`.

---

#### `GET /api/v1/quests/current/results` ⬜

Podium and leaderboard. Available only once results are published.

**Auth:** none.

**`200`** →
```jsonc
{ "ok": true, "data": {
    "podium": [ /* ResultEntry × up to 3 */ ],
    "leaderboard": [ /* ResultEntry[] */ ],
    "publishedAt": "2026-09-22T07:00:00.000Z"
} }
```

**Errors:** `404 not_found` before `resultsAt` — results that do not exist yet are not found, not
forbidden. The frontend shows "Results are published on 22 September".

---

#### `GET /api/v1/participants/me/certificate` ⬜

The data a certificate is rendered from. Everyone who completed the quiz gets one.

**Auth:** required.

**`200`** → `{ "ok": true, "data": { /* CertificateData */ } }`

**Errors:** `401 unauthorized`, `404 not_found` (did not complete the quiz, or results not published).

> **TBD-3 — resolved for now: client-rendered.** Only this JSON endpoint exists. Server-side
> rendering would put a headless browser in the API for a once-a-year artifact; if it is ever wanted,
> it is an additional URL, not a change to this one.

---

#### `GET /api/v1/admin/participants` ⬜

**Auth:** required, `role === 'admin'`, enforced server-side on every call.

**Query:** `q` (name or number substring), `questId` (default: current), `page` (default 1),
`limit` (default 50, max 200).

**`200`** →
```jsonc
{ "ok": true, "data": {
    "items": [ /* Participant[] — includes contact; admins need to reach people */ ],
    "page": 1, "limit": 50, "total": 412
} }
```

**Errors:** `401 unauthorized`, `403 forbidden`.

---

#### `PATCH /api/v1/admin/quests/:id` ⬜

Edit the admin-owned content of a quest: book, dates, prizes, quiz metadata.

**Auth:** required, `role === 'admin'`.

**Body:** any subset of —
```jsonc
{
  "book": { "title": "...", "author": "...", "pages": 197, "coverUrl": "...",
            "description": "...", "resources": [ { "label": "...", "url": "...", "kind": "pdf" } ] },
  "prizes": { "first": "...", "second": "...", "third": "..." },
  "opensAt": "2026-08-01T09:00:00.000Z",
  "readingDeadline": "2026-09-20T18:59:00.000Z",
  "quizOpensAt": "...", "quizClosesAt": "...", "resultsAt": "...",
  "quizQuestionCount": 20, "quizDurationMinutes": 30
}
```

**`200`** → `{ "ok": true, "data": { /* Quest */ } }`

**Errors:** `400 validation_failed` (including date-ordering violations —
`opensAt < readingDeadline ≤ quizOpensAt < quizClosesAt ≤ resultsAt`), `401`, `403`, `404`.

> `edition`, `year` and `participantCount` are **not** editable. Edition and year are identity;
> `participantCount` is maintained by the registration path.

---

#### `POST /api/v1/admin/quests` ⬜ · `POST /api/v1/admin/quests/:id/make-current` ⬜

Create next year's edition, and switch which one is current (in a transaction, so there is never
zero or two current quests).

**Auth:** required, `role === 'admin'`. **`200`/`201`** → `Quest`.

---

#### `GET /api/v1/admin/stats` ⬜

Dashboard numbers: registrations today, total, quiz submissions, completion rate.

**Auth:** required, `role === 'admin'`.

**`200`** → `{ "ok": true, "data": { "participants": 412, "registeredToday": 17, "quizSubmitted": 0, "phase": "reading" } }`

---

### Not in this contract

The quiz — question delivery, answer submission, scoring, anti-cheat, timing — is a separate future
plan. No quiz endpoints are defined here beyond the metadata (`quizOpensAt`, `quizQuestionCount`)
the Home screen needs to describe it. Neither side should build against an imagined quiz API.
