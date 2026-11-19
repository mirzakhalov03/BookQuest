# Bot refresh — Design

**Goal:** the bot looks and feels as polished as the Mini App:
1. **The menu button** (bottom-left of the chat) actually opens the Mini App.
2. An **"Open" button in the Telegram chat list** next to BookQuest.
3. **Premium (custom) emojis** in the bot's messages.
4. **Better copy**, starting with the intro, which gets a **photo**.

**Today:** `bot.ts` calls `setChatMenuButton` (a global default, no `chat_id`) on boot. `/start` sends
`TEXTS.welcome` (plain text) with the reply keyboard, then `TEXTS.getStarted` with an inline web-app button.
The About page already sends a photo with an HTML caption and caches the `file_id` (`handlers/about.ts`).

**Anti-goals:**
- Custom emoji that show as blank squares or broken text when Telegram rejects them. Every one has a normal
  emoji fallback.
- An intro so long it scrolls off the screen. It stays a short caption (<1024 chars).
- Breaking `REPLY_KEYBOARD_LABELS` matching: button labels are plain text and stay standard emoji.

---

## 1. Menu button doesn't open the Mini App

Investigate first (with `superpowers:systematic-debugging`), then fix. Likely causes in order:
1. **A per-chat override.** `setChatMenuButton` without `chat_id` sets only the **default**. Chats where an older
   bot (the legacy Telegraf bot) set a per-chat button keep it. Check with `getChatMenuButton({ chat_id })` for an
   affected user.
2. **Stale or invalid URL** in prod `WEB_APP_URL` (Railway env), or a URL that's not HTTPS or doesn't match the domain set in
   BotFather.
3. **A BotFather-level menu button** set to commands or a different URL, overriding or conflicting with the API one.

**Fix (whatever the cause, these make it robust):**
- On `/start`, also call `setChatMenuButton({ chat_id, menu_button: web_app })` for that chat, which clears any stuck
  override. It's cheap and idempotent.
- On boot, log the result of `getChatMenuButton()` (default) so a wrong URL is visible in logs.
- Document the BotFather settings in the bot README section (see §2).

## 2. "Open" in the chat list (Main Mini App)

This is Telegram's **Main Mini App** feature, configured in **@BotFather**, not in code:
`/mybots → BookQuest → Bot Settings → Configure Mini App → Enable Mini App`, URL = the prod web app URL. Once
enabled, Telegram shows an **Open** button on the bot in the chat list and on its profile.
- The web app must accept that launch: it carries `initData` like the menu button, so sign-in works. Verify
  `start_param` handling is harmless when empty.
- Add a "Telegram setup" checklist to `apps/bot/README.md` (create it if missing): menu button, Main Mini App,
  domain for the Login Widget, privacy mode for the feedback group.

## 3. Premium emojis

Telegram renders custom emoji through `<tg-emoji emoji-id="…">🔥</tg-emoji>` in HTML messages.
**Prerequisite to verify first:** bots can only send custom emoji if the bot has an **additional username bought
on Fragment**. If BookQuest's bot doesn't have one, Telegram strips them to the fallback emoji. Confirm with one test
message before doing the rest. If they're stripped, either buy a Fragment username (an organiser decision, with cost) or
stop at the copy refresh.

- `apps/bot/src/emoji.ts`: `const EMOJI = { book: { id: '…', fallback: '📚' }, … }` and
  `e(name): string` → `<tg-emoji emoji-id="ID">FALLBACK</tg-emoji>`. IDs come from a chosen pack (organisers pick
  it; get the IDs by forwarding the emoji to @JsonDumpBot or reading `getCustomEmojiStickers`).
- Use it in the HTML texts only (welcome caption, about, feedback headers). Message texts that are plain (no
  `parse_mode`) are switched to HTML with proper escaping (`lib/html.ts` already exists).
- **Never** in reply-keyboard labels or inline-button text: buttons can't render custom emoji, and labels are matched
  as strings.

## 4. Intro with a photo and refined copy

- `/start` sends **one photo message** (`assets/intro/intro.jpg`, organisers supply it, 1280×720 or similar) with
  the welcome as an HTML caption **and** the inline "Open BookQuest" web-app button, then a short second message that
  only pins the reply keyboard (a message can carry one keyboard type, so the existing two-message reason still holds).
- Reuse the about handler's photo-sending and `file_id` caching. Extract `sendCachedPhoto(ctx, file, extra)`
  into `lib/photo.ts` and use it in both.
- **Copy** (Uzbek, a draft for organisers to approve):
  - Caption: "<b>📚 BookQuest'ga xush kelibsiz!</b>\n\nHar yili bitta kitob, minglab kitobxon va bitta savol: kim
    uni eng yaxshi o‘qidi?\n\n📖 Kitobni o‘qing → 🧠 testni topshiring → 🏆 sovrinlarni yutib oling.\nOxirigacha
    yetgan har bir ishtirokchi sertifikat oladi."
  - Second message: "Pastdagi menyudan biz haqimizda bilib oling yoki savol yuboring 👇"
  - Review the other texts too (`fallback`, `feedbackIntro`, `feedbackClosed`, `getStarted`), aiming for shorter, warmer, one
    idea per line.

---

## Out of scope
- Multilingual bot (it stays Uzbek by design).
- Bot-side quest data (book titles, dates) in messages.

## Prerequisites (organisers)
- The intro photo.
- A custom-emoji pack choice, and whether the bot has or will get a Fragment username.
- BotFather: enable the Main Mini App.
