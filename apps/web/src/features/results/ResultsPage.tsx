import { useMemo } from 'react';
import { useCurrentQuest } from '@/features/home/api/useCurrentQuest';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Countdown } from '@/components/ui/Countdown';
import { Rule } from '@/components/ui/Rule';
import { ApiRequestError } from '@/lib/api/client';
import { formatLongDate } from '@/lib/format';
import { useQuestResults } from './api/useQuestResults';
import { ResultsPodium } from '@/components/ResultsPodium';
import { LeaderboardRow } from '@/components/LeaderboardRow';

/** A 404 the API means literally: "not found" covers both "no quest running"
 * and "results not published yet" — the frontend tells them apart by asking
 * which query answered it, not by the message text. */
function isNotFound(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.status === 404 && error.code === 'not_found';
}

/**
 * `/results` — public (spec §3), and one of the screens read-only web mode
 * has to render in full (spec §7): nothing here needs a session.
 *
 * A tab-bar root, like Home and `/book` — see `BookPage`'s note on why that
 * means no Telegram back button.
 */
export function ResultsPage() {
  const results = useQuestResults();

  if (results.isPending) return <LoadingState label="Tallying the scores…" />;

  if (results.error) {
    // Results that don't exist yet are *not yet*, not a failure (spec,
    // contract) — the countdown state below, not this retry button.
    if (isNotFound(results.error)) return <BeforeResults />;

    return (
      <Screen>
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      </Screen>
    );
  }

  const { podium, leaderboard, publishedAt } = results.data;

  if (leaderboard.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="No one finished the quiz"
          body="The results are in, but nobody submitted an attempt this year."
        />
      </Screen>
    );
  }

  return (
    <Screen className="max-w-3xl gap-8">
      <header className="flex flex-col gap-1">
        <p className="type-label">Results</p>
        <h1 className="type-display text-3xl text-paper">Published {formatLongDate(publishedAt)}</h1>
      </header>

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
function BeforeResults() {
  const quest = useCurrentQuest();

  // Memoised on the ISO string, exactly like Home's countdown target: a
  // fresh `Date` every render would change `useCountdown`'s effect
  // dependency every time and loop.
  const resultsAtIso = quest.data ? quest.data.resultsAt : null;
  const target = useMemo(() => (resultsAtIso ? new Date(resultsAtIso) : null), [resultsAtIso]);

  if (quest.isPending) return <LoadingState label="Checking the calendar…" />;

  if (quest.error) {
    // No quest running at all — there is no `resultsAt` to count down to,
    // so this reads as the same between-editions invitation Home gives.
    if (isNotFound(quest.error)) {
      return (
        <Screen>
          <EmptyState
            title="Nothing to publish yet"
            body="There's no quest running between editions. Check back once the next one opens."
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
        <p className="type-label">Results</p>
        <h1 className="type-display text-3xl text-paper">Not published yet</h1>
      </header>

      <Countdown
        label="Results published in"
        target={target}
        dateText={`Results are published on ${formatLongDate(quest.data.resultsAt)}`}
      />
    </Screen>
  );
}
