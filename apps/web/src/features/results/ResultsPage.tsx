import { useMemo } from 'react';
import { useCurrentQuest, useRefreshCurrentQuest } from '@/lib/api/quest';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Countdown } from '@/components/ui/Countdown';
import { Rule } from '@/components/ui/Rule';
import { isNotFound } from '@/lib/api/client';
import { formatLongDate } from '@/lib/format';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useQuestResults } from './api/useQuestResults';
import { ResultsPodium } from '@/components/ResultsPodium';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { FullBoardPrompt } from './components/FullBoardPrompt';
import { ReviewAnswersLink } from './components/ReviewAnswersLink';
import { useT } from '@/i18n';

/**
 * `/results` — public (spec §3). Signed out, the API sends only the podium;
 * the full board and your rank need a session (audit B6).
 *
 * A tab-bar root, like Home and `/book` — see `BookPage`'s note on why that
 * means no Telegram back button.
 */
export function ResultsPage() {
  usePullToRefresh();
  const results = useQuestResults();
  const t = useT();

  if (results.isPending) return <LoadingState label={t.results.loading} />;

  if (results.error) {
    // Results that don't exist yet are *not yet*, not a failure (spec,
    // contract) — the countdown state below, not this retry button.
    if (isNotFound(results.error)) return <BeforeResults onPublished={() => void results.refetch()} />;

    return (
      <Screen>
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      </Screen>
    );
  }

  const { podium, leaderboard, finishedCount, isFullBoard, publishedAt } = results.data;

  if (finishedCount === 0) {
    return (
      <Screen>
        <EmptyState
          title={t.results.nobodyTitle}
          body={t.results.nobodyBody}
        />
      </Screen>
    );
  }

  return (
    <Screen className="max-w-3xl gap-8">
      <header className="flex flex-col gap-1">
        <p className="type-label">{t.results.label}</p>
        <h1 className="type-display text-3xl text-paper">{t.results.published(formatLongDate(publishedAt))}</h1>
        <ReviewAnswersLink />
      </header>

      <ResultsPodium entries={podium} />

      {isFullBoard ? (
        <section className="flex flex-col gap-1">
          <p className="type-label">{t.results.fullLeaderboard}</p>
          <Rule />
          <ol className="flex flex-col">
            {leaderboard.map((entry) => (
              <LeaderboardRow key={entry.number} entry={entry} highlight={entry.rank <= 5} />
            ))}
          </ol>
        </section>
      ) : (
        <FullBoardPrompt finishedCount={finishedCount} />
      )}
    </Screen>
  );
}

/**
 * The 404-before-`resultsAt` state (spec, plan Phase 5): a countdown to the
 * date on `quest.resultsAt`, reusing `Countdown` exactly as Home does, not a
 * retry button for something that isn't broken.
 *
 * Fetches `useCurrentQuest()` itself rather than taking it as a prop — this
 * is the one branch that needs it, and it's the same cached query Home and
 * `/book` already read (spec §6: one resource, several views).
 */
function BeforeResults({ onPublished }: { onPublished: () => void }) {
  const quest = useCurrentQuest();
  const t = useT();
  const refreshQuest = useRefreshCurrentQuest();

  // Memoised on the ISO string, exactly like Home's countdown target: a
  // fresh `Date` every render would change `useCountdown`'s effect
  // dependency every time and loop.
  const resultsAtIso = quest.data ? quest.data.resultsAt : null;
  const target = useMemo(() => (resultsAtIso ? new Date(resultsAtIso) : null), [resultsAtIso]);

  if (quest.isPending) return <LoadingState label={t.quiz.loading} />;

  if (quest.error) {
    // No quest running at all — there is no `resultsAt` to count down to,
    // so this reads as the same between-editions invitation Home gives.
    if (isNotFound(quest.error)) {
      return (
        <Screen>
          <EmptyState
            title={t.results.nothingTitle}
            body={t.results.nothingBody}
          />
        </Screen>
      );
    }
    return (
      <Screen>
        <ErrorState error={quest.error} onRetry={() => quest.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen className="flex-1 justify-center gap-6">
      <header className="flex flex-col gap-1 text-center">
        <p className="type-label">{t.results.label}</p>
        <h1 className="type-display text-3xl text-paper">{t.results.notYetTitle}</h1>
      </header>

      <Countdown
        label={t.results.publishedIn}
        target={target}
        dateText={t.results.publishedOn(formatLongDate(quest.data.resultsAt))}
        onComplete={() => {
          refreshQuest();
          onPublished();
        }}
      />
    </Screen>
  );
}
