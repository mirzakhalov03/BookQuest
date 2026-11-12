import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatCount, formatLongDate } from '@/lib/format';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useQuizStandings } from './api/useQuizLive';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';
import { RefreshButton } from './components/RefreshButton';
import { CertificatesPanel } from './certificates/CertificatesPanel';
import { StandingsTable } from './results/StandingsTable';

/** `/admin/results` — live standings while people solve, the frozen board once results are out. */
export function ResultsInspectionPage() {
  usePullToRefresh();
  const standings = useQuizStandings();

  return (
    <AdminQuery
      query={standings}
      loadingLabel="Tallying the scores…"
      notFound={(error) => <EmptyState title={error.message} body="Create this year's quest first." className="flex-1" />}
    >
      {({ rows, finished, solving, resultsAt, isPublished }) => (
        <AdminScreen className="max-w-4xl">
          <AdminPageHeader
            eyebrow="Results"
            title={isPublished ? `Published ${formatLongDate(resultsAt)}` : 'Live standings'}
            actions={
              <RefreshButton
                onRefresh={() => void standings.refetch()}
                refreshing={standings.isFetching}
                updatedAt={standings.dataUpdatedAt}
              />
            }
          />
          <p className="m-0 text-sm text-taupe">
            {formatCount(finished)} finished · {formatCount(solving)} solving
            {!isPublished && ` · ranks are provisional until ${formatLongDate(resultsAt)}`}
          </p>

          {rows.length === 0 ? (
            <EmptyState
              titleAs="h2"
              title={isPublished ? 'No one finished the quiz' : 'No one has started yet'}
              body={isPublished ? 'Nobody submitted an attempt this year.' : 'People appear here the moment they begin.'}
              className="flex-1"
            />
          ) : (
            <StandingsTable rows={rows} />
          )}

          {/* Certificates go out from the final board only. */}
          {isPublished && finished > 0 && <CertificatesPanel />}
        </AdminScreen>
      )}
    </AdminQuery>
  );
}
