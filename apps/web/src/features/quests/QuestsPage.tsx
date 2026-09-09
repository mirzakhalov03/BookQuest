import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { useQuestArchive } from './api/useQuestArchive';
import { QuestSummaryCard } from './components/QuestSummaryCard';

/**
 * The archive: every edition before the current one. A tab-bar destination
 * like `/book`, so no Telegram back button — see `BookPage`'s note.
 *
 * Today, against the real API, this list is empty: there is exactly one
 * quest on record and it is the current one, which `GET /quests` excludes by
 * design. That makes the empty branch below the one this screen is actually
 * seen in, not a fallback nobody looks at.
 */
export function QuestsPage() {
  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useQuestArchive();

  if (isPending) return <LoadingState label="Opening the archive…" />;

  if (error) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const editions = data.pages.flatMap((page) => page.items);

  return (
    <Screen className="gap-6">
      <header className="flex flex-col gap-1">
        <p className="type-label">The archive</p>
        <h1 className="type-display text-3xl text-paper">Every quest before this one</h1>
      </header>

      {editions.length === 0 ? (
        <EmptyState
          title="Nothing archived yet"
          body="Every past edition's book, winner and finishing count will collect here once one closes."
        />
      ) : (
        <>
          <ul className="flex flex-col">
            {editions.map((quest) => (
              <li key={quest.id}>
                <QuestSummaryCard quest={quest} />
              </li>
            ))}
          </ul>

          {/* An explicit action, not an infinite scroller — a handful of past
              editions is exactly the list an infinite scroller is hardest to
              use on, and a scroll position is nothing anyone can link to. */}
          {hasNextPage && (
            <Button
              variant="quiet"
              className="self-center"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      )}
    </Screen>
  );
}
