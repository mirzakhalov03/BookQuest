import { Composer, Markup, type Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { logger } from '../config/logger.js';
import { openFeedbackSession, rememberPrompt, takePrompt } from '../lib/feedback-state.js';
import { mention } from '../lib/html.js';
import { react } from '../lib/react.js';
import { relay } from '../lib/relay.js';
import { FEEDBACK_REPLY_ACTION, feedbackKeyboard } from '../keyboards.js';
import { TEXTS } from '../texts.js';

/**
 * The organizers' side. Only an answer to the bot's prompt (opened by the
 * reply button) reaches the participant — ordinary replies in the group stay
 * internal, so organizers can discuss a message freely.
 */
export const feedbackGroup = new Composer<Context>();

feedbackGroup.action(FEEDBACK_REPLY_ACTION, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = Number(ctx.match[1]);
  const post = ctx.callbackQuery.message;
  if (!post) return;

  // Selective + the mention: only the organizer who tapped gets the reply box opened.
  const prompt = await ctx.reply(TEXTS.groupPrompt(mention(ctx.from)), {
    parse_mode: 'HTML',
    reply_parameters: { message_id: post.message_id },
    ...Markup.forceReply().selective()
  });
  rememberPrompt(prompt.message_id, userId);
});

feedbackGroup.on(message('reply_to_message'), async (ctx) => {
  const prompt = ctx.message.reply_to_message;
  if (prompt.from?.id !== ctx.botInfo.id) return;

  const userId = takePrompt(prompt.message_id);
  if (userId === undefined) {
    // Our prompt, but forgotten (restart or already answered) — say so rather than drop silently.
    const isPrompt = 'text' in prompt && prompt.text.startsWith(TEXTS.groupPromptMarker);
    if (isPrompt)
      await ctx.reply(TEXTS.groupPromptExpired, {
        reply_parameters: { message_id: ctx.message.message_id }
      });
    return;
  }

  try {
    await relay(ctx.telegram, userId, ctx.message, TEXTS.feedbackAnswerHeader, {
      replyMarkup: feedbackKeyboard.reply_markup,
      quote: true
    });
    // The answer reopens the chat, so the participant can just write back.
    openFeedbackSession(userId);
    await react(ctx.telegram, ctx.chat.id, ctx.message.message_id);
  } catch (error) {
    logger.warn(
      { err: error, telegramUserId: String(userId) },
      'Could not deliver feedback answer'
    );
    await ctx.reply(TEXTS.groupDeliveryFailed, {
      reply_parameters: { message_id: ctx.message.message_id }
    });
  }
});
