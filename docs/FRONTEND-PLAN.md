# BookQuest — Frontend Implementation Plan

> Frontend only. Architecture and the full API contract are in `FRONTEND-SPEC.md`; the backend's
> matching roadmap is in `BACKEND-PLAN.md`. Phases are ordered by dependency, not by calendar.

**How to read the dependency column.** Each phase names exactly what it needs from the backend. If
that endpoint is not ready, the frontend builds against the contract and a local mock — the shape is
agreed, so the swap is a one-line base-URL change, not a rewrite. Nothing here blocks on the backend
except where marked **hard block**.

---

## Phase 0 — Setup audit and gaps

**Deliverable:** the existing setup verified and the missing pieces named, with nothing recreated.

Already working, not to be touched: Vite 8 + React 19 + Tailwind 4 build, `@` alias, repo-root
`envDir`, the design tokens in `theme.css`, `lib/api/client.ts`, `useCountdown`, the query client's
retry policy, and the feature-first folder layout.

**Gaps to close in this phase:**

1. **`src/vite-env.d.ts`** typing `ImportMetaEnv` so a missing `VITE_API_URL` fails the build rather
   than silently producing an undefined base URL.
2. **`git init`** — the repo is not under version control. Everything else in this plan assumes it is.
3. **ESLint** — `pnpm lint` delegates to a turbo `lint` task that no workspace defines. Either add
   `eslint` + `typescript-eslint` + `eslint-plugin-react-hooks`, or drop the script. A no-op script
   that looks like a check is worse than no script.
   **Resolution (Task 1):** dropped. `typescript-eslint` does not support TypeScript 7.0 — every
   entry point (`typescript-eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`)
   hard-throws at import when it resolves a `typescript` peer with major version ≥ 7, and this repo
   is pinned to `typescript@7.0.2`. A scoped `pnpm.overrides` (`parent>child` selectors) to give the
   ESLint toolchain a side-by-side `typescript@6.0.3` was tried and does not work: pnpm rewrites the
   declared peer range but still resolves to the one physical `typescript` already in the graph, so
   the same throw happens. Tracked upstream at typescript-eslint#10940. Revisit once that lands, or
   the repo moves off pinning `typescript-eslint` against the same compiler line as the app.
4. **`prototype/` must keep building nothing.** It has no build step and must stay that way — it is
   the visual reference, opened directly in a browser. Do not fold it into the Vite app.

**Deployment audit — current state: nothing is configured.** No Dockerfile, no CI, no host config,
no `vercel.json`, no `.github/`. What exists is `pnpm dev` on ports 5173 and 4000.

Recommendation for the web app, matching "easy deployment, minimal dependencies":

| Concern | Recommendation |
|---|---|
| Host | Any static host. The build is `dist/` — Vercel, Netlify, or Nginx all work. Vercel is the least configuration for a pnpm monorepo (`apps/web` as the root, `pnpm build --filter @bookquest/web...`). |
| SPA routing | The host must rewrite unknown paths to `/index.html`, or every direct link to `/register` 404s. This is the single most common deploy failure for `createBrowserRouter`. |
| API URL | `VITE_API_URL` is **baked in at build time**, not read at runtime. Preview and production need separate builds. Do not try to make it dynamic. |
| Dev/prod split | Separate `MONGODB_URI` and `CORS_ORIGIN` per environment. `CORS_ORIGIN` is already comma-separated so preview URLs are additive. |
| HTTPS | **Required.** Telegram refuses to load a Mini App over `http://`. Local Telegram testing needs a tunnel (`cloudflared`, `ngrok`) — `server.host: true` is already set for this. |
| Mini App registration | BotFather → `/newapp` → set the URL. The domain must match exactly, including subdomain. Also needed for the Login Widget if TBD-1 resolves to option B. |

**Depends on backend:** nothing.

**Open questions:** none.

---

## Phase 1 — Auth and API plumbing

Runs in parallel with the backend's Phase 1. The frontend can build the whole flow against the
contract before `/auth/telegram` exists.

**Frontend delivers:**

- `lib/auth/tokenStore.ts` — read/write/clear a token in `localStorage`, read synchronously so the
  first request already carries it.
- `lib/auth/useAuth.ts` — the `/auth/me` query plus the login mutation. One hook, used everywhere.
- `AuthProvider` in `app/providers.tsx` — runs the `initData` exchange once at boot, holds the app
  on a splash until it resolves, and marks the session as `authenticated | anonymous | unavailable`.
- `lib/api/client.ts` 🚧 — inject `Authorization`; on `401`, clear the token and retry the login
  exchange **once** before surfacing the error.
- `RequireAuth` / `RequireAdmin` route wrappers — **UX only.** They exist so nobody is shown a
  screen that will 403. They are not security and are never described as such.
- Read-only web mode: when there is no Telegram bridge, the app renders fully and registration shows
  "Continue in Telegram" instead of the form.
- `components/feedback/` — `LoadingState`, `ErrorState`, `EmptyState`, written in the product's
  voice. `ErrorState` shows `error.message` verbatim, because the API writes messages for people.
- `ErrorBoundary` + router `errorElement`, so a render error shows the dark shell and a way back
  rather than a white screen.

**Depends on backend:**
`POST /auth/telegram`, `GET /auth/me`, and the `forbidden` code added to `API_ERROR_CODES`
(**hard block** on that last one — it is a shared-package type the frontend imports).

**Open questions:**
- **TBD-1** — web fallback. Building option A (read-only). If it becomes option B (Login Widget),
  the change is one extra login path; the rest of this phase is unaffected.

---

## Phase 2 — Design system and the production shell

The largest phase. The prototype becomes React without becoming a different design.

**Frontend delivers:**

- `styles/stage.css` — the 3D book, spotlight, podium, motes, and the countdown digit cell, ported
  from `prototype/styles/home.css` **verbatim where possible**. Hand-written CSS, not Tailwind
  utilities: the geometry is `calc()` on custom properties inside multi-part transforms, which
  Tailwind's arbitrary-value syntax cannot express legibly, and the values are already correct.
- `.type-numeral` added to `base.css` — the fixed `0.62em` digit cell that keeps numerals from
  twitching as the countdown ticks.
- `components/ui/` — `Field`, `Switch`, `Toast`, `Rule`, `Spinner`, alongside the existing `Button`.
- `components/layout/` — `Screen`, `TopBar`, `TabBar`. `TabBar` gets real destinations and
  safe-area padding.
- `AppLayout` 🚧 — atmosphere layer plus `TabBar`, with tab-bar clearance on scrollable content.
- `lib/telegram.ts` 🚧 — `BackButton` wired to router navigation, `HapticFeedback` on the primary
  action and on the number reveal. **`MainButton` deliberately unused** — the design's own button is
  part of the stage composition, and moving it into Telegram's chrome would break it.
- `lib/format.ts` — `Intl`-based long date ("20 September 2026, 23:59"), thousands separators, and
  the participant-number display format. No date library.
- Route transitions reusing the prototype's `--mid` timing and `--ease-out` easing.

**Porting discipline.** The prototype is the reference, open side by side. Three specific traps,
each of which already cost a round of fixes once:

1. Book tilt must stay **positive** (27° / 29°). Negative rotation hides the spine and the book
   reads as a flat rectangle.
2. The spine faces the light and must be **brighter** than the cover. A darkening gradient makes it
   read as a shadow and it vanishes.
3. Countdown units need `flex: 1 1 0; min-width: 0` below 900px, reverting to `flex: 0 0 auto`
   above. Without it the row overflows narrow viewports — and a headless screenshot will not show
   this, because Chrome clamps windows to 500px minimum. Render into a 390×844 iframe to check.

**Depends on backend:** nothing. This is pure presentation.

**Open questions:** none. The design is locked and the typography change is already applied.

---

## Phase 3 — Registration and Home

The two screens the prototype defines, on real data.

**Frontend delivers:**

- `RegisterPage` — the full title page: edition mark, display title, lede, and the form.
  - `NameField` — validates on blur with `parseFullName` from `@bookquest/shared`, clears the
    message on input, shows the normalised name back on success.
  - `ContactField` + `MethodSwitch` — swaps placeholder (`@your_username` / `+998 90 123 45 67`),
    `inputmode`, and the live formatter. Uzbek numbers group as you type; every other country's
    digits are left exactly as entered.
  - Submit maps `ApiRequestError.fields` straight onto inputs by field path.
- `SuccessScreen` — beam, "You're in.", the gold rule-draw, digits setting one at a time. The number
  comes **only** from the API response.
- `HomePage` — `BookStage`, `StageAside`, `Countdown`, `QuestAction`, all fed by
  `GET /quests/current`.
  - `data-phase={quest.phase}` on the root, so the gold "quiz finished" treatment cascades from one
    attribute selector exactly as it does in the prototype.
  - Countdown target derived from the phase: `readingDeadline` while reading, `quizClosesAt` during
    the quiz, frozen when finished. **Never a hardcoded date.**
  - `QuestAction` renders the four states the design specifies — Join BookQuest / Go to the book /
    Enter the quiz / View results — chosen from `quest.phase` and whether `user.participant` exists.
- `BookPage` — description and resources.
- Empty state for `404 not_found` on `/quests/current`: "No quest is running right now." This is a
  normal condition between editions, presented as an invitation to come back, not as an error.
- `session.store.ts` 🚧 narrowed: the persisted number becomes a first-paint hint only.
  `/participants/me` is the truth and always wins.

**Depends on backend:**
`GET /quests/current` including `prizes`, `book.description`, `book.resources`, `quizQuestionCount`
(**hard block** — the copy needs the real fields); `POST /participants` with auth;
`GET /participants/me`.

**Open questions:**
- **TBD-2** — does registration close at the deadline? The prototype's copy says
  *"Registration closes when the reading period ends."* If yes, the `unregistered` Home state needs
  a fifth variant for "registration closed, quest in progress".
- **TBD-4** — are book resources public, or only for registered participants? Affects whether
  `BookPage` needs a gate.
- **TBD-5** — the 1000-participant cap. If the ID range becomes 5 digits, `NumberReveal`'s digit
  spacing and the `.type-numeral` cell width both change. Cheap now, annoying after launch.

---

## Phase 4 — Admin area

**Frontend delivers:**

- `AdminLayout` — same palette, tokens and type as the participant app, but denser: side or top nav
  instead of a tab bar, tables instead of a stage, no spotlight. It should read as the same product
  seen from behind, not as a different one.
- `/admin` — dashboard: participant count, registrations today, current phase, days remaining.
- `/admin/participants` — searchable, paginated table. Number, name, contact, registered date.
- `/admin/quest` — edit book (title, author, pages, cover, description, resources), the five dates,
  and the three prizes. Client-side date-ordering feedback that **mirrors, never replaces**, the
  server's validation.
- `/admin/results` — read-only result inspection.
- Admin nav is hidden unless `user.role === 'admin'`, and this is **presentation only**. Every admin
  screen's data comes from an endpoint that checks the role server-side. A user who flips the flag
  in devtools sees an admin shell full of `403 forbidden`.

**Depends on backend:**
`GET /admin/participants`, `PATCH /admin/quests/:id`, `GET /admin/stats`, `GET /admin/results`, and
`requireAdmin` enforcing 403 (**hard block** — without server enforcement this phase ships a hole).

**Open questions:**
- Cover image: URL field, or an upload endpoint? A URL field needs no storage decision and is the
  right first answer. **TBD-6.**
- Should an admin be able to register on behalf of someone who cannot use Telegram? Realistic for a
  local contest; changes the registration contract. **TBD-7.**

---

## Phase 5 — Results and certificates

Minimal scope.

**Frontend delivers:**

- `/results` — podium (top 3, gold treatment, the one place gold is used at scale) plus the full
  leaderboard, ranked by score then speed.
- Empty state before `resultsAt`: "Results are published on 22 September" with a countdown, reusing
  the `Countdown` component. Results that do not exist yet are *not yet*, not an error.
- `/me` — profile: number, name, contact, quest history, and the certificate.
- `Certificate` — rendered from `CertificateData` using the same tokens, wide-Archivo display type,
  and gold rules as the rest of the product. Download via `html-to-image` or an equivalent, **if**
  TBD-3 resolves to client-side rendering.
- `/quests` and `/quests/:edition` — the archive.

**Depends on backend:**
`GET /quests/current/results`, `GET /participants/me/certificate`, `GET /quests`,
`GET /quests/:edition`.

**Open questions:**
- **TBD-3** — certificate rendered client-side from JSON, or server-side as a PDF? Client-side keeps
  the design in one codebase and adds no dependency to the API; server-side gives a stable, shareable
  file and a verification URL. The JSON endpoint is needed either way, so this can be decided late.
- Is the leaderboard fully public, or top-N public with the rest visible only to the person
  concerned? A reading contest usually publishes everything, but it is a real privacy choice.

---

## Phase 6 — Quiz

**Not planned here.** The quiz interface — question delivery, timing, answer submission, anti-cheat,
progress recovery — is a separate plan with its own contract.

What this plan does provide: the `/quiz` route is reserved, `QuestAction` already renders the "Enter
the quiz" state, and the Home screen reads `quizOpensAt` / `quizClosesAt` / `quizQuestionCount` to
describe the quiz. **Do not build against an imagined quiz API.**

---

## Consolidated open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| TBD-1 | Web fallback: read-only, or Telegram Login Widget? | Phase 1 (building read-only) | Product |
| TBD-2 | Does registration close at the reading deadline? | Phase 3 Home states | Product |
| TBD-3 | Certificate rendered client-side or server-side? | Phase 5 | Product / both |
| TBD-4 | Book resources public, or registered-only? | Phase 3 `BookPage` | Product |
| TBD-5 | 1000-participant cap, or widen the ID range? | Phase 3 numerals — **settle before Phase 1 ships** | Product |
| TBD-6 | Cover image: URL field or upload? | Phase 4 | Product |
| TBD-7 | Admin-assisted registration? | Phase 4 | Product |
