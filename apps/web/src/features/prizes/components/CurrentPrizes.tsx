import { useCurrentQuest } from '@/lib/api/quest';
import { isNotFound } from '@/lib/api/client';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatOrdinalEdition } from '@/lib/format';
import { PrizePodium, hasAnyPrize } from './PrizePodium';

/** What this edition's winners take home. Reads the same cached current quest as Home and `/book`. */
export function CurrentPrizes() {
  const { data: quest, isPending, error, refetch } = useCurrentQuest();

  if (isPending) return <LoadingState label="Polishing the trophies…" />;

  if (error) {
    // Between editions there's no current quest — the archive below still has something to show.
    if (isNotFound(error)) {
      return (
        <EmptyState
          title="No quest running right now"
          body="Prizes for the next edition will show up here once it opens."
        />
      );
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const hasPrizes = hasAnyPrize(quest.prizes);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="type-label">
          {formatOrdinalEdition(quest.edition)} edition · {quest.year}
        </p>
        <h1 className="type-display text-3xl text-paper">Up for the winners</h1>
      </header>

      {hasPrizes ? (
        <PrizePodium prizes={quest.prizes} />
      ) : (
        <p className="text-taupe">The prizes for this edition haven't been announced yet. Check back soon.</p>
      )}
    </section>
  );
}
