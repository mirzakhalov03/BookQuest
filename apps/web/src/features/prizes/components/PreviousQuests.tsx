import type { QuestSummary } from '@bookquest/shared';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { useQuestArchive } from '@/lib/api/quest';
import { QuestSummaryCard } from './QuestSummaryCard';

/** Every edition before the current one. `GET /quests` already leaves out the current one. */
export function PreviousQuests() {
  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useQuestArchive();

  return (
    <section className="flex flex-col gap-2">
      <h2 className="type-label m-0">Previous quests</h2>

      {isPending ? (
        <LoadingState label="Opening the archive…" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <PreviousQuestList
          editions={data.pages.flatMap((page) => page.items)}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
        />
      )}
    </section>
  );
}

interface PreviousQuestListProps {
  editions: QuestSummary[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

function PreviousQuestList({ editions, hasNextPage, isFetchingNextPage, onLoadMore }: PreviousQuestListProps) {
  if (editions.length === 0) {
    return (
      <p className="py-4 text-taupe">
        Nothing here yet. Each past edition's book and winner will show up here once it closes.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col">
        {editions.map((quest) => (
          <li key={quest.id}>
            <QuestSummaryCard quest={quest} />
          </li>
        ))}
      </ul>

      {/* A button, not infinite scroll: a short list is easier to use this way. */}
      {hasNextPage && (
        <Button variant="quiet" className="self-center" onClick={onLoadMore} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </>
  );
}
