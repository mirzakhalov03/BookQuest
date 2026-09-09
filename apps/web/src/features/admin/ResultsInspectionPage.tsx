import { AdminScreen } from '@/layouts/AdminLayout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Rule } from '@/components/ui/Rule';
import { ResultsPodium } from '@/components/ResultsPodium';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { isNotFound } from '@/lib/api/client';
import { formatLongDate } from '@/lib/format';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useAdminResultsInspection } from './api/useAdminResultsInspection';
import { ForbiddenState, isForbidden } from './components/ForbiddenState';

/**
 * `/admin/results` — read-only. There is no admin-only results endpoint
 * (`apps/api/src/routes/admin/index.ts` mounts participants, quests and
 * stats — nothing else), so this reads the same public
 * `GET /quests/current/results` the participant `/results` screen does; see
 * `useAdminResultsInspection`.
 *
 * The podium and leaderboard rows are `ResultsPodium` and `LeaderboardRow`
 * from `components/` — promoted out of `features/results/` for exactly this
 * reuse, rather than this feature importing that one's internals (spec §4
 * rule 1). Unlike `/results`, this page doesn't reuse `ResultsPage`'s live
 * "not published yet" countdown: an admin already knows the quest's dates
 * from the editor one tab over, so the plain "not yet" message is enough —
 * there is nothing here worth a second component for.
 *
 * A child of the dashboard, so it gets the back button `/admin` itself
 * doesn't.
 */
export function ResultsInspectionPage() {
  useTelegramBackButton('/admin');

  const results = useAdminResultsInspection();

  if (results.isPending) return <LoadingState label="Tallying the scores…" />;

  if (results.error) {
    if (isForbidden(results.error)) return <ForbiddenState error={results.error} />;

    if (isNotFound(results.error)) {
      return (
        <EmptyState
          title={results.error.message}
          body="Check the quest editor for the results date."
          className="flex-1"
        />
      );
    }

    return (
      <ErrorState error={results.error} onRetry={() => results.refetch()} className="flex-1" />
    );
  }

  const { podium, leaderboard, publishedAt } = results.data;

  return (
    <AdminScreen className="max-w-3xl">
      <header className="flex flex-col gap-1">
        <p className="type-label">Results</p>
        <h1 className="type-display text-3xl text-paper">
          Published {formatLongDate(publishedAt)}
        </h1>
      </header>

      {leaderboard.length === 0 ? (
        <EmptyState
          title="No one finished the quiz"
          titleAs="h2"
          body="The results are in, but nobody submitted an attempt this year."
          className="flex-1"
        />
      ) : (
        <>
          <ResultsPodium entries={podium} />

          <section className="flex flex-col gap-1">
            <p className="type-label">Full leaderboard</p>
            <Rule />
            <ol className="flex flex-col">
              {leaderboard.map((entry) => (
                <LeaderboardRow key={entry.number} entry={entry} />
              ))}
            </ol>
          </section>
        </>
      )}
    </AdminScreen>
  );
}
