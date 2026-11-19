# Certificate Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two uploadable certificate designs per quest (participation, and winner for ranks 1–5). Certificates render text on top of the uploaded art, with placeholder art as the fallback.

**Architecture:** Collapse tiers to `winner | participant`. Store the design images in a GridFS bucket referenced from the quest. The satori template draws the image as a background and positions text from a per-tier layout config. The admin Certificates page uploads, previews and replaces them.

**Tech Stack:** Mongoose GridFS, satori + resvg, multer (as covers), React.

**Spec:** `docs/superpowers/specs/2026-11-20-certificate-templates-design.md`

## Global Constraints

- No automated tests. Verify with `pnpm typecheck` plus a rendered-PNG check.
- `CERTIFICATE_TIERS = ['winner', 'participant']`. Winner = rank 1–5.
- Design file rules: PNG/JPEG, ≤8 MB, width ≥2246px, aspect 1123:794 ±3%.
- Layout space is 1123×794 (render at 2×). Existing `/verify/:code` and `/certificates/:code/image.png` URLs keep working.
- Missing design → placeholder art for that tier.
- Admin copy in `en`/`uz`/`ru`. Certificate text in Uzbek.

## Review Focus

- A 32-character Cyrillic name on the winner design: fits its box with no clipping (`nameSize` steps).
- Replacing a design: the in-memory render cache and the HTTP ETag both change (the key includes the file id), so nobody sees a stale image.
- An upload exactly at 2246px wide but portrait: rejected with the clear message, nothing stored.
- Results with rank 6: participant design, no rank line.
- Certificate delivery in progress (`MAX_CONCURRENT_RENDERS = 1`) while the admin replaces the design: later sends use the new art, and nothing crashes mid-batch.

---

### Task 1: Tiers 1–5

**Files:**
- Modify: `packages/shared/src/schemas/result.ts` (`CERTIFICATE_TIERS`, `CertificatePlacing`, `certificateTier`)
- Modify: `apps/api/src/certificates/template.tsx` (`ACCENT`, `ORDINAL` → keyed by placing 1–5), `apps/api/src/certificates/samples.ts`
- Modify: web readers of `tier` (grep `tier ===`, `'gold'` in `apps/web/src`), `apps/web/src/lib/api/mock/*`

**Interfaces:** `certificateTier(rank: number | null): { placing: CertificatePlacing | null; tier: CertificateTier }`.

- [ ] **Step 1:** Shared change, then build shared.
- [ ] **Step 2:** Update the template and samples (`winner1`, `winner4`, `participant`, `long`, `cyrillic`). Update `CERTIFICATE_SAMPLE_KEYS` consumers (admin preview routes).
- [ ] **Step 3:** Fix the web compile errors. The rank label comes from `placing`.
- [ ] **Step 4:** `pnpm typecheck`. Render `winner4` via the admin preview endpoint and check it says 4th place.
- [ ] **Step 5: Commit** `feat(certificates): winner tier covers ranks 1–5`

### Task 2: Design storage and upload API

**Files:**
- Create: `apps/api/src/services/certificate-design.services.ts`
- Modify: `apps/api/src/models/quest.model.ts` (`certificateDesigns`), the admin quest DTO + `packages/shared/src/schemas/admin.ts`
- Modify: `apps/api/src/routes/admin.routes.ts` (or wherever cover upload lives), plus a controller and validator
- Modify: `apps/api/src/services/cover.services.ts` (extract the shared GridFS upload/validate helper into `apps/api/src/utils/gridfs.ts` instead of copying it)

**Interfaces:**
- `PUT /api/v1/admin/certificates/designs/:tier` (multipart `file`) → `{ tier, fileId, url }`. `DELETE` same path → back to placeholder.
- `GET /api/v1/admin/certificates/designs/:fileId` streams the image (admin only).
- `loadDesignDataUri(fileId: string): Promise<string>` (memory cache, max 4 entries).
- `AdminQuest.certificateDesigns: { participant: string | null; winner: string | null }` (thumbnail URLs).

- [ ] **Step 1:** The GridFS helper extraction (covers keep working: re-upload a cover in a manual check).
- [ ] **Step 2:** Validation: decode dimensions with `sharp`. Check `apps/api/package.json` and use it if present. Otherwise read the PNG IHDR or JPEG SOF header in a small `utils/imageSize.ts` rather than adding a dependency.
- [ ] **Step 3:** Routes, model field and DTO. Replacing deletes the old GridFS file after the quest update succeeds.
- [ ] **Step 4:** `pnpm typecheck`. Manual check with curl: valid upload → 200. Portrait → 422 with the message. DELETE → null.
- [ ] **Step 5: Commit** `feat(api): upload certificate designs per quest`

### Task 3: Render on the uploaded art

**Files:** Modify `apps/api/src/certificates/template.tsx`, `apps/api/src/certificates/render.ts`, `apps/api/src/services/certificate.services.ts`

**Interfaces:**
- `LAYOUT: Record<CertificateTier, { name: Box; rank?: Box; book: Box; code: Box; qr: Box; color: string }>`, where `Box = { x: number; y: number; w: number; h: number; align?: 'left' | 'center' | 'right' }`. Start with centred defaults that suit a typical landscape certificate, and tune when the art arrives.
- `CertificateTemplate({ data, qrDataUri, sample, backgroundDataUri })`: with no background, today's placeholder drawing.
- Render cache key and ETag: `${TEMPLATE_VERSION}:${designFileId ?? 'placeholder'}:${code}`. Bump `TEMPLATE_VERSION` to 2.

- [ ] **Step 1:** `certificate.services.ts` resolves the quest's design id for the tier and passes the data URI to render.
- [ ] **Step 2:** The template draws the background `<img>` absolutely at 1123×794 and each layer in its box (satori: `position: 'absolute'`, `display: 'flex'`).
- [ ] **Step 3:** Remove `IS_PLACEHOLDER_ART`. The admin note now reads per tier from `certificateDesigns`.
- [ ] **Step 4:** `pnpm typecheck`. Upload two test images, render the samples (winner1, winner4, participant, long, cyrillic) and inspect the PNGs.
- [ ] **Step 5: Commit** `feat(certificates): render names on the uploaded artwork`

### Task 4: Admin Designs section

**Files:**
- Modify: `apps/web/src/features/admin/certificates/CertificatesPage.tsx`
- Create: `apps/web/src/features/admin/certificates/DesignCard.tsx`, `apps/web/src/features/admin/api/useCertificateDesigns.ts`
- Modify: `apps/web/src/features/admin/quest/components/ImagePicker.tsx` (`noDownscale?: boolean`)
- Modify: `apps/web/src/i18n/{en,uz,ru}/admin.ts`

- [ ] **Step 1:** Two `DesignCard`s: thumbnail or "Placeholder art" badge, Upload/Replace (confirm sheet on replace), Remove, then sample previews (`previewUrl.ts`) that refresh after upload (cache-bust with the file id).
- [ ] **Step 2:** Typecheck. Manual check: upload, preview, replace with confirm, remove → placeholder.
- [ ] **Step 3: Commit** `feat(admin): certificate design uploads with live previews`

### Task 5: Real art (organisers)

- [ ] Get the two final designs, upload them in prod, tune `LAYOUT` boxes against them (code change and deploy), and re-check the previews.
