import { Copy } from 'lucide-react';
import type { Participant } from '@bookquest/shared';
import { openTelegramLink } from '@/lib/telegram';
import { useUiStore } from '@/stores/ui.store';

type Contact = Participant['contact'];

function contactHref(contact: Contact): string {
  return contact.method === 'telegram'
    ? `https://t.me/${contact.value.replace(/^@/, '')}`
    : `tel:${contact.value.replace(/[^\d+]/g, '')}`;
}

/** Reaching someone is why this screen exists: one tap opens the chat or dials, one more copies. */
export function ContactLink({ contact }: { contact: Contact }) {
  const showToast = useUiStore((state) => state.showToast);
  const href = contactHref(contact);

  async function copy() {
    try {
      await navigator.clipboard.writeText(contact.value);
      showToast('Copied.');
    } catch {
      showToast("Couldn't copy. Long-press the contact to select it.");
    }
  }

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
        <span className="type-label mr-1">{contact.method}</span>
        {contact.value}
      </a>
      <button
        type="button"
        aria-label={`Copy ${contact.value}`}
        onClick={() => void copy()}
        className="grid h-9 w-9 shrink-0 place-items-center text-taupe hover:text-paper"
      >
        <Copy aria-hidden className="h-4 w-4" />
      </button>
    </span>
  );
}
