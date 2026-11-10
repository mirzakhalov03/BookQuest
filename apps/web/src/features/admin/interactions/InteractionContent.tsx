import type { Interaction } from '@bookquest/shared';
import { CornerDownRight } from 'lucide-react';

const MEDIA_LABEL: Record<NonNullable<Interaction['media']>['type'], string> = {
  photo: 'Photo',
  voice: 'Voice message',
  video: 'Video',
  video_note: 'Video note',
  audio: 'Audio',
  document: 'File',
  sticker: 'Sticker',
  animation: 'GIF'
};

function mediaLine(item: Interaction): string {
  const media = item.media;
  if (!media) return 'Media';
  const parts = [`${media.emoji ? `${media.emoji} ` : ''}${MEDIA_LABEL[media.type]}`];
  if (media.fileName) parts.push(media.fileName);
  if (media.durationSec) parts.push(`${media.durationSec}s`);
  const label = parts.join(' · ');
  return item.text ? `${label} — ${item.text}` : label;
}

function body(item: Interaction): string {
  switch (item.kind) {
    case 'text':
    case 'web_app_data':
      return item.text ?? '';
    case 'command':
      return `/${item.command ?? ''}${item.commandArgs ? ` ${item.commandArgs}` : ''}`;
    case 'button':
      return item.buttonLabel ?? item.callbackData ?? 'Button';
    case 'contact': {
      const contact = item.contact;
      if (!contact) return 'Contact';
      const whose = contact.isOwn
        ? ' (own number)'
        : contact.firstName
          ? ` (${contact.firstName})`
          : '';
      return `${contact.phoneNumber}${whose}`;
    }
    case 'media':
      return mediaLine(item);
    case 'location':
      return item.location
        ? `📍 ${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}`
        : 'Location';
    case 'membership':
      return item.membership === 'blocked' ? 'Blocked the bot' : 'Unblocked the bot';
    default:
      return 'Other update';
  }
}

/** React escapes text: whatever people typed renders as text, links included, never as markup. */
export function InteractionContent({ item }: { item: Interaction }) {
  const quiet = item.kind === 'membership' || item.kind === 'other';
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className={`m-0 whitespace-pre-wrap break-words ${quiet ? 'text-taupe' : 'text-paper'}`}>
        {body(item)}
        {item.isEdit && <span className="ml-2 text-xs text-taupe">(edited)</span>}
      </p>
      {item.inReplyTo?.text ? (
        <Context>Replying to “{item.inReplyTo.text}”</Context>
      ) : item.broadcast ? (
        <Context>After broadcast “{item.broadcast.snippet}”</Context>
      ) : null}
    </div>
  );
}

function Context({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 flex min-w-0 gap-1 text-xs text-taupe">
      <CornerDownRight aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
