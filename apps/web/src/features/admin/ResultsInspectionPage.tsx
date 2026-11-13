import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatCount, formatLongDate } from '@/lib/format';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useQuizStandings } from './api/useQuizLive';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';
import { RefreshButton } from './components/RefreshButton';
import { Link } from 'react-router';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { useT } from '@/i18n';
import { StandingsTable } from './results/StandingsTable';

/** `/admin/results` — live standings while people solve, the frozen board once results are out. */
export function ResultsInspectionPage() {
  usePullToRefresh();
  const t = useT().admin;
  const standings = useQuizStandings();

  return (
    <AdminQuery
      query={standings}
      loadingLabel="Tallying the scores…"
      notFound={(error) => (
        <EmptyState
          title={error.message}
          body="Create this year's quest first."
          className="flex-1"
        />
      )}
    >
      {({ rows, finished, solving, resultsAt, isPublished }) => (
        <AdminScreen className="max-w-4xl">
          <AdminPageHeader
            stacked
            eyebrow="Results"
            title={isPublished ? `Published ${formatLongDate(resultsAt)}` : 'Live standings'}
            actions={
              <RefreshButton onRefresh={() => void standings.refetch()} refreshing={standings.isFetching} />
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
              body={
                isPublished
                  ? 'Nobody submitted an attempt this year.'
                  : 'People appear here the moment they begin.'
              }
              className="flex-1"
            />
          ) : (
            <StandingsTable rows={rows} />
          )}

          {/* Certificates go out from the final board only; sending lives on its own page. */}
          {isPublished && finished > 0 && (
            <Link
              to="/admin/certificates"
              className="group inline-flex min-h-11 items-center gap-2 self-start text-gold hover:text-gold-soft"
            >
              {t.certificates.readyToSend}
              <ArrowIcon />
            </Link>
          )}
        </AdminScreen>
      )}
    </AdminQuery>
  );
}
