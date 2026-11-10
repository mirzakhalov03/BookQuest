import type { InteractionInput, MediaType } from '@bookquest/shared';
import { INTERACTION_LIMITS as L } from '@bookquest/shared';
import type { InlineKeyboardMarkup, Message, Update, User } from 'telegraf/types';
import { REPLY_KEYBOARD_LABELS } from '../keyboards.js';

type Base = Omit<InteractionInput, 'kind'>;
type Media = NonNullable<InteractionInput['media']>;

const cap = (value: string, max: number): string =>
  value.length > max ? value.slice(0, max) : value;
const capOpt = (value: string | undefined, max: number): string | undefined =>
  value ? cap(value, max) : undefined;

function base(
  updateId: number,
  updateType: string,
  from: User,
  sentAt: Date,
  extra: Partial<Base> = {}
): Base {
  return {
    updateId,
    updateType,
    telegramUserId: String(from.id),
    from: {
      firstName: cap(from.first_name, 128),
      lastName: capOpt(from.last_name, 128),
      username: capOpt(from.username, 64),
      languageCode: capOpt(from.language_code, 16)
    },
    sentAt: sentAt.toISOString(),
    ...extra
  };
}

/** Telegram update → one log row, or null for what isn't a person talking to the bot. */
export function toInteraction(update: Update, botId: number): InteractionInput | null {
  if ('message' in update) {
    return fromMessage(update.update_id, 'message', update.message, botId, false);
  }
  if ('edited_message' in update) {
    return fromMessage(update.update_id, 'edited_message', update.edited_message, botId, true);
  }
  if ('callback_query' in update) return fromCallback(update.update_id, update.callback_query);
  if ('my_chat_member' in update) return fromMembership(update.update_id, update.my_chat_member);

  const updateType = Object.keys(update).find((key) => key !== 'update_id') ?? 'unknown';
  const payload = (update as unknown as Record<string, { from?: User } | undefined>)[updateType];
  if (!payload?.from || payload.from.is_bot) return null;
  return { ...base(update.update_id, updateType, payload.from, new Date()), kind: 'other' };
}

function fromMessage(
  updateId: number,
  updateType: string,
  msg: Message,
  botId: number,
  isEdit: boolean
): InteractionInput | null {
  // No `from` = a channel post; a bot sender is never a person.
  if (!msg.from || msg.from.is_bot) return null;
  const head = base(updateId, updateType, msg.from, new Date(msg.date * 1000), {
    chatId: String(msg.chat.id),
    chatType: msg.chat.type,
    messageId: msg.message_id,
    inReplyTo: replyContext(msg, botId),
    ...(isEdit ? { isEdit: true } : {})
  });

  if ('text' in msg) {
    const command = leadingCommand(msg);
    if (command) return { ...head, kind: 'command', ...command };
    if (REPLY_KEYBOARD_LABELS.has(msg.text)) {
      return {
        ...head,
        kind: 'button',
        buttonLabel: cap(msg.text, L.buttonLabel),
        text: cap(msg.text, L.text)
      };
    }
    return { ...head, kind: 'text', text: cap(msg.text, L.text) };
  }
  if ('contact' in msg) {
    return {
      ...head,
      kind: 'contact',
      contact: {
        phoneNumber: cap(msg.contact.phone_number, 32),
        firstName: capOpt(msg.contact.first_name, 128),
        isOwn: msg.contact.user_id === msg.from.id
      }
    };
  }
  const media = mediaOf(msg);
  if (media) {
    return {
      ...head,
      kind: 'media',
      media,
      text: 'caption' in msg ? capOpt(msg.caption, L.text) : undefined
    };
  }
  // `venue` before `location`: a venue message carries both.
  if ('venue' in msg) {
    const { latitude, longitude } = msg.venue.location;
    return { ...head, kind: 'location', location: { lat: latitude, lng: longitude } };
  }
  if ('location' in msg) {
    const { latitude, longitude } = msg.location;
    return { ...head, kind: 'location', location: { lat: latitude, lng: longitude } };
  }
  if ('web_app_data' in msg) {
    return { ...head, kind: 'web_app_data', text: cap(msg.web_app_data.data, L.text) };
  }
  return { ...head, kind: 'other' };
}

function leadingCommand(
  msg: Message.TextMessage
): Pick<InteractionInput, 'command' | 'commandArgs'> | null {
  const entity = msg.entities?.[0];
  if (!entity || entity.type !== 'bot_command' || entity.offset !== 0) return null;
  const command = (msg.text.slice(1, entity.length).split('@')[0] ?? '').toLowerCase();
  const args = msg.text.slice(entity.length).trim();
  return { command: cap(command, L.command), commandArgs: capOpt(args, L.commandArgs) };
}

function file(
  type: MediaType,
  source: { file_id: string; file_unique_id: string },
  more: Partial<Media> = {}
): Media {
  return {
    type,
    fileId: cap(source.file_id, 256),
    fileUniqueId: cap(source.file_unique_id, 128),
    ...more
  };
}

// `animation` before `document`: an animation message carries both fields.
function mediaOf(msg: Message): Media | null {
  if ('photo' in msg) {
    const largest = msg.photo.at(-1);
    return largest ? file('photo', largest) : null;
  }
  if ('animation' in msg) {
    const a = msg.animation;
    return file('animation', a, {
      mimeType: a.mime_type,
      fileName: capOpt(a.file_name, 256),
      durationSec: a.duration
    });
  }
  if ('voice' in msg) {
    return file('voice', msg.voice, {
      mimeType: msg.voice.mime_type,
      durationSec: msg.voice.duration
    });
  }
  if ('video_note' in msg) {
    return file('video_note', msg.video_note, { durationSec: msg.video_note.duration });
  }
  if ('video' in msg) {
    const v = msg.video;
    return file('video', v, {
      mimeType: v.mime_type,
      fileName: capOpt(v.file_name, 256),
      durationSec: v.duration
    });
  }
  if ('audio' in msg) {
    const a = msg.audio;
    return file('audio', a, {
      mimeType: a.mime_type,
      fileName: capOpt(a.file_name, 256),
      durationSec: a.duration
    });
  }
  if ('sticker' in msg)
    return file('sticker', msg.sticker, { emoji: capOpt(msg.sticker.emoji, 16) });
  if ('document' in msg) {
    const d = msg.document;
    return file('document', d, { mimeType: d.mime_type, fileName: capOpt(d.file_name, 256) });
  }
  return null;
}

/** Filled only when the person used Telegram's Reply on one of *our* messages. */
function replyContext(msg: Message, botId: number): InteractionInput['inReplyTo'] {
  const reply = 'reply_to_message' in msg ? msg.reply_to_message : undefined;
  if (!reply || reply.from?.id !== botId) return undefined;
  const text = 'text' in reply ? reply.text : 'caption' in reply ? reply.caption : undefined;
  return { messageId: reply.message_id, text: capOpt(text, L.replySnippet) };
}

// A callback query has no `date`; receipt time is the closest truth.
function fromCallback(
  updateId: number,
  query: Update.CallbackQueryUpdate['callback_query']
): InteractionInput | null {
  if (query.from.is_bot) return null;
  const data = 'data' in query ? query.data : undefined;
  const msg = query.message;
  const markup = msg && 'reply_markup' in msg ? msg.reply_markup : undefined;
  return {
    ...base(updateId, 'callback_query', query.from, new Date(), {
      chatId: msg ? String(msg.chat.id) : undefined,
      messageId: msg?.message_id
    }),
    kind: 'button',
    callbackData: capOpt(data, L.callbackData),
    buttonLabel: capOpt(data ? labelFor(markup, data) : undefined, L.buttonLabel)
  };
}

function labelFor(markup: InlineKeyboardMarkup | undefined, data: string): string | undefined {
  return markup?.inline_keyboard
    .flat()
    .find((button) => 'callback_data' in button && button.callback_data === data)?.text;
}

/** Private chats only, and only real transitions: a first-time member isn't an "unblock". */
function fromMembership(
  updateId: number,
  change: Update.MyChatMemberUpdate['my_chat_member']
): InteractionInput | null {
  if (change.chat.type !== 'private' || change.from.is_bot) return null;
  const now = change.new_chat_member.status;
  const was = change.old_chat_member.status;
  const membership =
    now === 'kicked' ? 'blocked' : now === 'member' && was === 'kicked' ? 'unblocked' : null;
  if (!membership) return null;
  return {
    ...base(updateId, 'my_chat_member', change.from, new Date(change.date * 1000), {
      chatId: String(change.chat.id),
      chatType: 'private'
    }),
    kind: 'membership',
    membership
  };
}
