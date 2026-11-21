import type { QuestSummary } from '@bookquest/shared';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { useQuestArchive } from '@/lib/api/quest';
import { useState } from 'react';
import { PastQuestAccordion } from './PastQuestAccordion';
import { useT } from '@/i18n';

/** Every edition before the current one. `GET /quests` already leaves out the current one. */
export function PreviousQuests() {
  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useQuestArchive();
  const t = useT();

  return (
    <section className="flex flex-col gap-2">
      <h2 className="type-label m-0">{t.prizes.previous}</h2>

      {isPending ? (
        <LoadingState label={t.prizes.archiveLoading} />
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
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  if (editions.length === 0) {
    return (
      <p className="py-4 text-taupe">
        {t.prizes.archiveEmpty}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col">
        {editions.map((quest) => (
          <PastQuestAccordion
            key={quest.id}
            quest={quest}
            open={openId === quest.id}
            onToggle={() => setOpenId((current) => (current === quest.id ? null : quest.id))}
          />
        ))}
      </div>

      {/* A button, not infinite scroll: a short list is easier to use this way. */}
      {hasNextPage && (
        <Button variant="quiet" className="self-center" onClick={onLoadMore} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? t.common.loading : t.common.loadMore}
        </Button>
      )}
    </>
  );
}
