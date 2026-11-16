import { Markup } from 'telegraf';
import { env } from './config/env.js';
import { TEXTS } from './texts.js';

export const feedbackEnabled = Boolean(env.ADMIN_CHAT_ID);

/**
 * Every reply-keyboard label the bot shows. A tapped reply-keyboard button
 * arrives as plain text, so this registry is the only way the log can tell a
 * tap from typing. Add each new label here, and use it from here.
 */
export const REPLY_KEYBOARD_LABELS: ReadonlySet<string> = new Set<string>([
  TEXTS.aboutButton,
  TEXTS.feedbackButton,
  TEXTS.feedbackExitButton
]);

export const mainKeyboard = Markup.keyboard([
  feedbackEnabled ? [TEXTS.aboutButton, TEXTS.feedbackButton] : [TEXTS.aboutButton]
])
  .resize()
  .persistent();

// Swapped in for the whole feedback chat, so being "in a conversation" is visible.
export const feedbackKeyboard = Markup.keyboard([[TEXTS.feedbackExitButton]])
  .resize()
  .persistent();

// Inline, never a reply-keyboard web_app button: those launches carry no initData, which sign-in needs.
export const openAppKeyboard = Markup.inlineKeyboard([
  [Markup.button.webApp(TEXTS.openApp, env.WEB_APP_URL)]
]);

export const FEEDBACK_REPLY_ACTION = /^fb:(\d+)$/;

/** Under each relayed message in the organizers' group; carries who to answer. */
export const feedbackReplyKeyboard = (userId: number) =>
  Markup.inlineKeyboard([[Markup.button.callback(TEXTS.groupReplyButton, `fb:${userId}`)]]);
