import { useMemo } from 'react';
import { Navigate } from 'react-router';
import { useCurrentQuest, useRefreshCurrentQuest } from '@/lib/api/quest';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Countdown } from '@/components/ui/Countdown';
import { isNotFound } from '@/lib/api/client';
import { formatLongDate } from '@/lib/format';

/**
 * `/quiz` — placeholder until the quiz itself is built: a countdown to quiz
 * day. After the quiz closes the tab bar points at `/results` instead, and a
 * stale link here follows it there.
 */
export function QuizPage() {
  const { data: quest, isPending, error, refetch } = useCurrentQuest();
  const refreshQuest = useRefreshCurrentQuest();

  // Memoised on the ISO string — a fresh Date each render loops `useCountdown`.
  const targetIso = quest?.quizOpensAt ?? null;
  const target = useMemo(() => (targetIso ? new Date(targetIso) : null), [targetIso]);

  if (isPending) return <LoadingState label="Checking the calendar…" />;

  if (error) {
    if (isNotFound(error)) {
      return (
        <Screen>
          <EmptyState title="No quiz scheduled" body="Check back once the next edition opens." />
        </Screen>
      );
    }
    return (
      <Screen>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }

  if (quest.phase === 'finished') return <Navigate to="/results" replace />;

  return (
    <Screen className="flex-1 justify-center gap-6">
      <header className="flex flex-col gap-1 text-center">
        <p className="type-label">Quiz</p>
        <h1 className="type-display text-3xl text-paper">Quiz day is coming</h1>
      </header>

      <Countdown
        label="Quiz opens in"
        target={target}
        dateText={formatLongDate(quest.quizOpensAt)}
        onComplete={refreshQuest}
      />
    </Screen>
  );
}
