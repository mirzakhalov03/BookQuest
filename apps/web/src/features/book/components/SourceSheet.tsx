import { useEffect, useState } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import type { Book, BookResource, SourceCard } from '@bookquest/shared';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { openExternalLink } from '@/lib/telegram';
import { useT } from '@/i18n';
import { sourceSteps } from '../sourceSteps';
import { CARD_ACCENT, CARD_ICON, resourcesFor } from './cardConfig';

const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Opens outside the Mini App where Telegram can; a plain new tab otherwise. */
function openOut(url: string) {
  if (!openExternalLink(url)) window.open(url, '_blank', 'noopener,noreferrer');
}

/** Steps, then links. The movie card asks before leaving for YouTube; the sheet itself is the confirmation. */
export function SourceSheet({ book, card, onClose }: { book: Book; card: SourceCard | null; onClose: () => void }) {
  const t = useT().book;
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  // Keeps the last card while the sheet animates closed, so it doesn't empty mid-transition.
  const [shown, setShown] = useState<SourceCard>(card ?? 'ebook');

  useEffect(() => {
    if (card) setShown(card);
    else setLeavingTo(null);
  }, [card]);

  const copy = t.cards[shown];
  const Icon = CARD_ICON[shown];
  const steps = sourceSteps(book.guides[shown], copy.steps);
  const links = resourcesFor(book, shown);

  if (leavingTo) {
    return (
      <Sheet
        open={card !== null}
        onClose={onClose}
        title={t.leavingTitle}
        actions={
          <>
            <Button variant="quiet" onClick={() => setLeavingTo(null)}>
              {t.stay}
            </Button>
            <Button
              onClick={() => {
                openOut(leavingTo);
                onClose();
              }}
            >
              {t.openYoutube}
            </Button>
          </>
        }
      >
        <p className="m-0 text-paper-dim">{t.leavingBody}</p>
      </Sheet>
    );
  }

  return (
    <Sheet open={card !== null} onClose={onClose} title={copy.title}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-box"
            style={{ color: CARD_ACCENT[shown], background: `color-mix(in srgb, ${CARD_ACCENT[shown]} 16%, transparent)` }}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="m-0 text-sm text-taupe">{book.title}</p>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="type-label m-0">{t.cards.stepsHeading}</h3>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-paper-dim">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ash-hi text-xs tabular-nums text-paper">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {links.length > 0 && (
          <section className="flex flex-col gap-1">
            <h3 className="type-label m-0">{t.cards.linksHeading}</h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {links.map((resource) => (
                <li key={resource.url} className="border-b border-[var(--rule)] last:border-none">
                  {shown === 'movie' ? (
                    <MovieRow resource={resource} label={t.watch} onPick={() => setLeavingTo(resource.url)} />
                  ) : (
                    <LinkRow resource={resource} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  );
}

function RowText({ resource }: { resource: BookResource }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="break-words text-paper">{resource.label}</span>
      <span className="text-xs text-taupe-dim">{hostname(resource.url)}</span>
    </span>
  );
}

function LinkRow({ resource }: { resource: BookResource }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (openExternalLink(resource.url)) event.preventDefault();
      }}
      className="group flex items-center gap-3 py-3"
    >
      <RowText resource={resource} />
      <ArrowUpRight className="h-4 w-4 shrink-0 text-taupe group-hover:text-paper-dim" aria-hidden="true" />
    </a>
  );
}

function MovieRow({ resource, label, onPick }: { resource: BookResource; label: string; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="group flex w-full items-center gap-3 py-3 text-left">
      <RowText resource={resource} />
      <span className="flex items-center gap-1 text-sm text-amber">
        <Play className="h-4 w-4" aria-hidden="true" /> {label}
      </span>
    </button>
  );
}
