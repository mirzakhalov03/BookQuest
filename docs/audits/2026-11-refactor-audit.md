# Refactor & optimization audit — 2026-11-21

A short pass, measured where it was cheap to measure. The spec's rule: change only what a number or a real duplication justifies.

## Measured

**Web bundle** (`vite build`, gzip):

| Chunk | Size |
|---|---|
| Main entry (`index-*.js`) | **216 KB** (target < 180 KB) |
| Admin (`screens-*.js`, lazy) | 75 KB |
| CSS | 19.5 KB |

What's in the main entry (source bytes before minifying, from the source map): react-dom 533 KB, react-router 354 KB,
**zod 350 KB**, query-core 78 KB, **all three locales ~148 KB** (en/uz/ru, about 50 KB each), lucide 31 KB, quiz feature ~64 KB.

**Tried and reverted:** lazy-loading the quiz play/review and verify routes. Rolldown moved the shared code
(zod + `@bookquest/shared`) into a `format-*` chunk that still loads eagerly: 116 + 98 = 214 KB, a 2 KB saving
not worth the extra loading step on QR-verify links.

**API hot path:** `/auth/me` = user lookup + current quest + participant (3 small indexed reads). No N+1 found.
The participants roster now also runs one extra `$in` query for duplicate flags (one per page, indexed by `quest + contact.value`).

## Do now (done)

- `auth.services.ts`: three copies of the Telegram verification failure path → `requireVerified()`.
- `maskUsername` moved to `utils/mask.ts` (it was in login-code, and the duplicate guard needs it).
- Account merge reuses `withTransaction` (no new transaction plumbing).

## Do with the next feature that touches it

1. **Load only the active locale.** Expected −30 to −35 KB gzip from the main entry. Needs `useT` to handle an async
   dictionary (keep `en` bundled as the fallback, `import()` uz/ru). The biggest single win.
2. **Keep zod out of the participant entry.** The web imports `@bookquest/shared` schemas mostly for types and a few
   parsers (`parseFullName`, `parsePhoneNumber`). Split shared into a `parsers` entry that doesn't import zod, and use
   `import type` for schemas. Estimated −25 to −30 KB gzip.
3. **Split `lib/api/mock/routes.ts` (~950 lines) per resource**, the next time the mock changes.
4. **`quiz-attempt.services.ts` (764 lines)**: split scoring from lifecycle. Not during a live quiz window.

## Won't do

- Current-quest in-process cache: it's one indexed read per request, and staleness risk across instances isn't worth it at this traffic.
- Index changes: no slow query observed. Re-check with `explain` once there are thousands of participants.
