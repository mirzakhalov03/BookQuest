import type { Interaction } from '@bookquest/shared';
import { CornerDownRight } from 'lucide-react';
import { useT, type Messages } from '@/i18n';

type Words = Messages['admin']['messages'];

function mediaLine(item: Interaction, t: Words): string {
  const media = item.media;
  if (!media) return t.kinds.media;
  const parts = [`${media.emoji ? `${media.emoji} ` : ''}${t.media[media.type]}`];
  if (media.fileName) parts.push(media.fileName);
  if (media.durationSec) parts.push(t.seconds(media.durationSec));
  const label = parts.join(' · ');
  return item.text ? `${label} — ${item.text}` : label;
}

function body(item: Interaction, t: Words): string {
  switch (item.kind) {
    case 'text':
    case 'web_app_data':
      return item.text ?? '';
    case 'command':
      return `/${item.command ?? ''}${item.commandArgs ? ` ${item.commandArgs}` : ''}`;
    case 'button':
      return item.buttonLabel ?? item.callbackData ?? t.kinds.button;
    case 'contact': {
      const contact = item.contact;
      if (!contact) return t.kinds.contact;
      const whose = contact.isOwn
        ? t.ownNumber
        : contact.firstName
          ? ` (${contact.firstName})`
          : '';
      return `${contact.phoneNumber}${whose}`;
    }
    case 'media':
      return mediaLine(item, t);
    case 'location':
      return item.location
        ? `📍 ${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}`
        : t.kinds.location;
    case 'membership':
      return item.membership === 'blocked' ? t.blockedBot : t.unblockedBot;
    default:
      return t.otherUpdate;
  }
}

/** React escapes text: whatever people typed renders as text, links included, never as markup. */
export function InteractionContent({ item }: { item: Interaction }) {
  const quiet = item.kind === 'membership' || item.kind === 'other';
  const t = useT().admin.messages;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className={`m-0 whitespace-pre-wrap break-words ${quiet ? 'text-taupe' : 'text-paper'}`}>
        {body(item, t)}
        {item.isEdit && <span className="ml-2 text-xs text-taupe">{t.edited}</span>}
      </p>
      {item.inReplyTo?.text ? (
        <Context>{t.replyingTo(item.inReplyTo.text)}</Context>
      ) : item.broadcast ? (
        <Context>{t.afterBroadcast(item.broadcast.snippet)}</Context>
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
