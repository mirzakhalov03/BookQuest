import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Rule } from '@/components/ui/Rule';
import { ResultsPodium } from '@/components/ResultsPodium';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { formatLongDate } from '@/lib/format';
import { useAdminResultsInspection } from './api/useAdminResultsInspection';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';

/**
 * `/admin/results` — read-only, and the same public `GET /quests/current/results`
 * the participant screen reads (see `useAdminResultsInspection`).
 */
export function ResultsInspectionPage() {
  const results = useAdminResultsInspection();

  return (
    <AdminQuery
      query={results}
      loadingLabel="Tallying the scores…"
      notFound={(error) => (
        <EmptyState title={error.message} body="Check the quest editor for the results date." className="flex-1" />
      )}
    >
      {({ podium, leaderboard, publishedAt }) => (
        <AdminScreen className="max-w-3xl">
          <AdminPageHeader eyebrow="Results" title={`Published ${formatLongDate(publishedAt)}`} />

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
      )}
    </AdminQuery>
  );
}
