# Bot Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A menu button that opens the Mini App, an "Open" button in the chat list, premium emojis with fallbacks, and a photo intro with refreshed copy.

**Architecture:** A per-chat menu button reset on `/start` plus boot-time logging. Main Mini App via BotFather (documented). A small `emoji.ts` helper emits `<tg-emoji>` with fallbacks. A shared cached-photo sender serves both `/start` and About.

**Tech Stack:** Telegraf, Telegram Bot API (HTML parse mode).

**Spec:** `docs/superpowers/specs/2026-11-20-bot-refresh-design.md`

## Global Constraints

- No automated tests. Verify with `pnpm --filter @bookquest/bot typecheck` plus a manual check in a real Telegram chat (test bot token).
- Bot copy is Uzbek only. Captions stay ≤1024 chars (measured on the raw HTML).
- Custom emoji only inside HTML message text, never in button labels. Every one has a standard-emoji fallback.
- Inline web-app buttons only (reply-keyboard web-app launches carry no `initData`).
- Every user-provided string in HTML goes through `lib/html.ts` escaping.

## Review Focus

- A user who blocked and then unblocked the bot sends `/start`: the per-chat menu reset doesn't throw on a 403. Log it and carry on.
- The intro photo file is missing from the deploy: `/start` falls back to the text welcome, no crash.
- The `file_id` cache after a bot restart: the first `/start` re-uploads, later ones reuse it.
- Custom emoji stripped (no Fragment username): messages read naturally with the fallbacks, with no doubled emoji.
- The feedback relay still works: the header texts changed to include `e()` and HTML stays valid (no unclosed tags).

---

### Task 1: Menu button fix and Telegram setup docs

**Files:**
- Modify: `apps/bot/src/handlers/start.ts`, `apps/bot/src/bot.ts`
- Create or modify: `apps/bot/README.md` (Telegram setup checklist)

**Interfaces:** `syncChatMenuButton(telegram: Telegram, chatId: number): Promise<void>` in `apps/bot/src/lib/menu-button.ts`, swallowing and logging errors.

- [ ] **Step 1: Investigate.** With the prod token (read-only calls), `getChatMenuButton` with no chat, then with the affected user's chat id. Record which of spec §1's causes it is in the commit message.
- [ ] **Step 2:** `syncChatMenuButton` on `/start` (after `upsertUser`). On boot, log `getChatMenuButton()`'s URL.
- [ ] **Step 3:** README checklist (menu button, Main Mini App path in BotFather, Login Widget domain, group privacy mode).
- [ ] **Step 4:** Typecheck. Manual check with the test bot: `/start`, then tap the bottom-left button → the Mini App opens signed in.
- [ ] **Step 5: Commit** `fix(bot): reset the chat's menu button on /start; Telegram setup checklist`
- [ ] **Step 6 (organiser, BotFather):** enable the Main Mini App for the prod bot. Check that "Open" appears in the chat list.

### Task 2: Premium emoji helper

**Files:**
- Create: `apps/bot/src/emoji.ts`
- Modify: `apps/bot/src/texts.ts` (HTML texts use `e()`), any `reply` that now needs `parse_mode: 'HTML'`

**Interfaces:**
- `EMOJI: Record<EmojiName, { id: string | null; fallback: string }>` (null id → fallback only, so this can merge before the pack is picked).
- `e(name: EmojiName): string`.

- [ ] **Step 1: Prerequisite check.** Send one `<tg-emoji>` message from the test and prod bots. If it's stripped, write that in the PR and keep ids null (fallbacks only).
- [ ] **Step 2:** The helper plus names for every emoji currently in `TEXTS` (book, target, chat, back, info, globe, sparkle, trophy, brain).
- [ ] **Step 3:** Swap the HTML texts to `e()`. Make sure plain-text replies that gain emoji markup move to HTML.
- [ ] **Step 4:** Typecheck. Manual check: about, feedback headers and welcome render, and the button labels are unchanged.
- [ ] **Step 5: Commit** `feat(bot): premium emoji with plain fallbacks`

### Task 3: Photo intro and copy pass

**Files:**
- Create: `apps/bot/src/lib/photo.ts`, `apps/bot/assets/intro/intro.jpg` (organiser asset. Use a temporary branded image until supplied)
- Modify: `apps/bot/src/handlers/about.ts` (use `sendCachedPhoto`), `apps/bot/src/handlers/start.ts`, `apps/bot/src/texts.ts`

**Interfaces:**
- `sendCachedPhoto(ctx: Context, assetPath: string, extra: { caption?: string; parse_mode?: 'HTML'; reply_markup?: … }): Promise<Message.PhotoMessage>`: `file_id` cache keyed by path, falls back to an upload.
- `TEXTS.welcomeCaption` (HTML), `TEXTS.menuHint`. `welcome` and `getStarted` are removed.

- [ ] **Step 1:** Extract `sendCachedPhoto` from `about.ts` and keep About's behaviour identical.
- [ ] **Step 2:** `/start`: photo with `welcomeCaption` + `openAppKeyboard`, then `menuHint` + `mainKeyboard`. If the asset is missing, send `welcomeCaption` as a text message with the same keyboard.
- [ ] **Step 3:** Copy pass on the remaining texts (draft in spec §4). Flag to organisers for approval in the PR description.
- [ ] **Step 4:** Typecheck. Manual check: `/start` twice (the second is fast, cached), About still works, captions ≤1024.
- [ ] **Step 5: Commit** `feat(bot): photo intro and refreshed copy`
