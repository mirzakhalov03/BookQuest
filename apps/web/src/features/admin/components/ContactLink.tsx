import { Phone } from 'lucide-react';
import type { Participant } from '@bookquest/shared';
import { TelegramIcon } from '@/components/ui/TelegramIcon';
import { openTelegramLink } from '@/lib/telegram';
import { CopyButton } from './CopyButton';

type Contact = Participant['contact'];

function contactHref(contact: Contact): string {
  return contact.method === 'telegram'
    ? `https://t.me/${contact.value.replace(/^@/, '')}`
    : `tel:${contact.value.replace(/[^\d+]/g, '')}`;
}

/** Reaching someone is why this screen exists: one tap opens the chat or dials, one more copies. */
export function ContactLink({ contact }: { contact: Contact }) {
  const href = contactHref(contact);

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <a
        href={href}
        target={contact.method === 'telegram' ? '_blank' : undefined}
        rel="noreferrer"
        onClick={(event) => {
          // Inside the Mini App a t.me link should open the chat in Telegram, not a browser.
          if (contact.method === 'telegram' && openTelegramLink(href)) event.preventDefault();
        }}
        className="min-w-0 truncate text-paper-dim underline decoration-[color:var(--rule-strong)] underline-offset-4 hover:text-paper"
      >
        {contact.method === 'telegram' ? (
          <TelegramIcon aria-label="Telegram" role="img" className="mr-1.5 inline-block h-4 w-4 -translate-y-px" />
        ) : (
          <Phone aria-label="Phone" role="img" className="mr-1.5 inline-block h-4 w-4 -translate-y-px" />
        )}
        {contact.value}
      </a>
      <CopyButton value={contact.value} label={`Copy ${contact.value}`} />
    </span>
  );
}
