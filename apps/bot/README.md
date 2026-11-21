# BookQuest bot

Telegraf bot for `@bookquest_bot`: `/start`, About, and the feedback chat. Everything else lives in the Mini App.

## Telegram setup checklist (@BotFather)

Telegram stores these settings itself, so a deploy doesn't set them. Check them after changing the domain.

- **Menu button** (bottom-left of the chat). The bot writes it on boot and on `/start`, **in production only**
  (`NODE_ENV=production` on Railway). Local runs share the token and would replace everyone's button with their
  tunnel URL. Check it with `getChatMenuButton`.
- **"Open" in the chat list (Main Mini App).** `/mybots → BookQuest → Bot Settings → Configure Mini App → Enable Mini App`,
  URL `https://bookquest.uz`. `getMe` reports `has_main_web_app: true` once it's on.
- **Login Widget domain.** `/setdomain` → `bookquest.uz` (site sign-in and Profile → Connect Telegram).
- **Group privacy.** Keep privacy mode on. The organisers' group only needs replies to the bot's own messages.
- **Premium (custom) emoji** in messages only render if the bot owns an extra username bought on Fragment.
  Otherwise Telegram shows the fallback emoji (see `src/emoji.ts`).
