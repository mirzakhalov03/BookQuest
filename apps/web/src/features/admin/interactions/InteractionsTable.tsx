import { useEffect, useRef } from 'react';
import type { Interaction } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { formatLongDate, formatTimeAgo } from '@/lib/format';
import { CopyButton } from '../components/CopyButton';
import { InteractionContent } from './InteractionContent';
import { KindChip } from './KindChip';
import { useT } from '@/i18n';

interface InteractionsTableProps {
  items: Interaction[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** Omit inside the person sheet, where every row is the same person. */
  onOpenPerson?: (telegramUserId: string) => void;
  /** Cards at every width — for the person sheet, too narrow for a table. */
  compact?: boolean;
}

/**
 * Cards below `sm`, a table from `sm` — the same split as ParticipantsTable:
 * a message body is the one cell that can be any length, and a card keeps it
 * readable at 360px without a sideways scroll.
 */
export function InteractionsTable({
  items,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onOpenPerson,
  compact = false
}: InteractionsTableProps) {
  const t = useT().admin.messages;
  return (
    <div className="flex flex-col gap-4">
      <ul className={`flex flex-col gap-2 ${compact ? '' : 'sm:hidden'}`}>
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-box border border-[color:var(--rule)] px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              {onOpenPerson ? <PersonCell item={item} onOpen={onOpenPerson} /> : <span />}
              <Time iso={item.sentAt} className="shrink-0 text-right" />
            </div>
            <div className="flex items-start gap-2">
              <KindChip kind={item.kind} />
              <InteractionContent item={item} />
            </div>
          </li>
        ))}
      </ul>

      {!compact && (
        <div className="hidden sm:block">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--rule-strong)] text-taupe">
                <th className="type-label w-28 py-2 pr-3 font-normal">{t.colTime}</th>
                <th className="type-label w-56 py-2 pr-3 font-normal">{t.colPerson}</th>
                <th className="type-label w-28 py-2 pr-3 font-normal">{t.colKind}</th>
                <th className="type-label py-2 pr-3 font-normal">{t.colContent}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[color:var(--rule)] align-top">
                  <td className="py-3 pr-3">
                    <Time iso={item.sentAt} />
                  </td>
                  <td className="py-2 pr-3">
                    {onOpenPerson && <PersonCell item={item} onOpen={onOpenPerson} />}
                  </td>
                  <td className="py-3 pr-3">
                    <KindChip kind={item.kind} />
                  </td>
                  <td className="py-3 pr-3">
                    <InteractionContent item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LoadMore hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={onLoadMore} />
    </div>
  );
}

/** Relative inside a day; the exact time is in `title` on hover and printed on phones. */
function Time({ iso, className = '' }: { iso: string; className?: string }) {
  const exact = formatLongDate(iso);
  return (
    <span className={`flex flex-col ${className}`}>
      <time dateTime={iso} title={exact} className="text-sm text-paper-dim">
        {formatTimeAgo(iso)}
      </time>
      <span className="text-xs text-taupe-dim sm:hidden">{exact}</span>
    </span>
  );
}

function PersonCell({ item, onOpen }: { item: Interaction; onOpen: (id: string) => void }) {
  const t = useT().admin.messages;
  const name = [item.from.firstName, item.from.lastName].filter(Boolean).join(' ') || t.unknown;
  const id = item.telegramUserId;
  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        onClick={() => onOpen(id)}
        className="min-w-0 truncate text-left text-paper underline decoration-[color:var(--rule-strong)] underline-offset-4 hover:decoration-paper"
      >
        {name}
      </button>
      <span className="flex min-w-0 items-center gap-1 text-xs text-taupe">
        {item.from.username && <span className="truncate">@{item.from.username} ·</span>}
        <span className="shrink-0" title={id}>
          {id.length > 6 ? `${id.slice(0, 5)}…` : id}
        </span>
        <CopyButton value={id} label={t.copyIdOf(name)} />
        {item.fromAdmin && (
          <span className="rounded-full border border-[color:var(--rule)] px-1.5">{t.organiser}</span>
        )}
      </span>
    </div>
  );
}

/** Loads the next page as the end scrolls near; the button covers keyboards and blocked observers. */
function LoadMore({
  hasMore,
  isLoadingMore,
  onLoadMore
}: Pick<InteractionsTableProps, 'hasMore' | 'isLoadingMore' | 'onLoadMore'>) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { common, admin } = useT();
  const t = admin.messages;
  // In a ref so an inline callback from the parent doesn't recreate the observer each render.
  const load = useRef(onLoadMore);
  load.current = onLoadMore;

  // Recreated whenever loading settles: a new observer reports the current state, so a
  // short page that leaves the sentinel on screen still pulls the next one.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || isLoadingMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) load.current();
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  return (
    <div ref={sentinel} className="flex justify-center">
      {hasMore && (
        <Button variant="quiet" onClick={onLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? t.loadingMore : common.loadMore}
        </Button>
      )}
    </div>
  );
}
