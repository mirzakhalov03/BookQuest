import { useMemo } from 'react';
import type { Quest } from '@bookquest/shared';
import { useCurrentQuest } from './api/useCurrentQuest';
import { BookStage } from './components/BookStage';
import { StageAside } from './components/StageAside';
import { QuestAction } from './components/QuestAction';
import { Countdown } from '@/components/ui/Countdown';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { ApiRequestError } from '@/lib/api/client';
import { formatLongDate } from '@/lib/format';

/**
 * The stage every other screen is measured against. `BookStage` and
 * `StageAside` lay out the book itself; `Countdown` and `QuestAction` read
 * `quest.phase` to say what's happening and what to do about it — neither
 * derives the phase, both just render what the API already computed
 * (spec §4 rule 4).
 */
export function HomePage() {
  const { data: quest, isPending, error, refetch } = useCurrentQuest();

  // Memoised on the ISO string, not recreated every render — a fresh Date
  // instance each render would change useCountdown's effect dependency every
  // time, re-firing the effect and looping (setTime -> render -> new Date ->
  // ...). `null` (the `finished` phase) flows straight through to a frozen
  // `useCountdown(null)`.
  const targetIso = quest ? countdownTargetIso(quest) : null;
  const target = useMemo(() => (targetIso ? new Date(targetIso) : null), [targetIso]);

  if (isPending) return <LoadingState label="Setting the stage…" />;

  if (error) {
    // A quest-free gap between editions is a normal condition, not a failure
    // (spec, plan Phase 3) — it gets the invitation, not the retry button.
    if (error instanceof ApiRequestError && error.status === 404 && error.code === 'not_found') {
      return (
        <Screen>
          <EmptyState title={error.message} body="Check back once the next edition opens." />
        </Screen>
      );
    }
    return (
      <Screen>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }

  return (
    <div className="view--home flex flex-1 flex-col" data-phase={quest.phase}>
      <TopBar year={quest.year} />

      <main className="home">
        <div className="stage">
          <StageAside variant="left" title={quest.book.title} author={quest.book.author} />

          <BookStage
            title={quest.book.title}
            author={quest.book.author}
            coverUrl={quest.book.coverUrl}
          />

          <StageAside
            variant="right"
            pages={quest.book.pages}
            quizOpensAt={quest.quizOpensAt}
            participantCount={quest.participantCount}
          />
        </div>

        <Countdown label={countdownLabel(quest.phase)} target={target} dateText={countdownDateText(quest)} />

        <QuestAction quest={quest} />
      </main>
    </div>
  );
}

/** `null` means frozen — `finished` has nothing left to count down to. */
function countdownTargetIso(quest: Quest): string | null {
  switch (quest.phase) {
    case 'upcoming':
      return quest.opensAt;
    case 'reading':
      return quest.readingDeadline;
    case 'quiz':
      return quest.quizClosesAt;
    case 'finished':
      return null;
  }
}

/**
 * The prototype has no `upcoming` phase to borrow copy from — TBD-2 (the
 * fifth QuestAction row) postdates it. "Reading opens in" mirrors "Quiz
 * closes in" 's shape (verb + "in") rather than reusing "Reading deadline",
 * which only reads right once the reading period has actually started.
 */
function countdownLabel(phase: Quest['phase']): string {
  switch (phase) {
    case 'upcoming':
      return 'Reading opens in';
    case 'reading':
      return 'Reading deadline';
    case 'quiz':
      return 'Quiz closes in';
    case 'finished':
      return 'Quiz closed';
  }
}

/**
 * The line under the clock. `finished` is the one phase where it names a
 * date other than the countdown's own (frozen) target — the prototype's
 * `setState('finished')` does the same, pointing at `resultsAt` instead of
 * repeating the quiz's close time.
 */
function countdownDateText(quest: Quest): string {
  switch (quest.phase) {
    case 'upcoming':
      return formatLongDate(quest.opensAt);
    case 'reading':
      return formatLongDate(quest.readingDeadline);
    case 'quiz':
      return formatLongDate(quest.quizClosesAt);
    case 'finished':
      return `Results published ${formatLongDate(quest.resultsAt)}`;
  }
}
