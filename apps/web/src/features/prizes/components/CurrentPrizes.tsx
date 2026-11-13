import { useCurrentQuest } from '@/lib/api/quest';
import { isNotFound } from '@/lib/api/client';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { hasAnyPrize } from '@bookquest/shared';
import { PrizeShowcase } from './PrizeShowcase';
import { useT } from '@/i18n';

/** What this edition's winners take home. Reads the same cached current quest as Home and `/book`. */
export function CurrentPrizes() {
  const t = useT();
  const { data: quest, isPending, error, refetch } = useCurrentQuest();

  if (isPending) return <LoadingState label={t.prizes.loading} />;

  if (error) {
    // Between editions there's no current quest — the archive below still has something to show.
    if (isNotFound(error)) {
      return (
        <EmptyState
          title={t.common.noQuest}
          body={t.prizes.noQuestBody}
        />
      );
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const hasPrizes = hasAnyPrize(quest.prizes);
  const edition = t.common.editionYear(quest.edition, quest.year);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="type-label">{edition}</p>
        <h1 className="type-display text-3xl text-paper">{t.prizes.upForWinners}</h1>
      </header>

      {hasPrizes ? (
        <PrizeShowcase prizes={quest.prizes} label={edition} />
      ) : (
        <p className="text-taupe">{t.prizes.notAnnounced}</p>
      )}
    </section>
  );
}
