import { useCallback, useMemo } from 'react';
import { Navigate } from 'react-router';
import { isResultsOut, type Quest } from '@bookquest/shared';
import { useCurrentQuest, useRefreshCurrentQuest } from '@/lib/api/quest';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Countdown } from '@/components/ui/Countdown';
import { Button } from '@/components/ui/Button';
import { isNotFound } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { formatLongDate } from '@/lib/format';
import { useQuizOverview } from './api/useQuizOverview';
import { OverviewCard } from './components/OverviewCard';
import { useT } from '@/i18n';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

/**
 * `/quiz` — the overview (§4.1): the server's `/quiz/me` state for a signed-in
 * reader, the plain countdown for everyone else. Once results are out it
 * follows the tab bar to `/results`.
 */
export function QuizPage() {
  usePullToRefresh();
  const { status } = useAuth();
  const t = useT();
  const { data: quest, isPending, error, refetch } = useCurrentQuest();

  if (quest && isResultsOut(quest)) return <Navigate to="/results" replace />;
  if (status === 'authenticated') return <SignedIn quest={quest} />;

  if (isPending) return <LoadingState label={t.quiz.loading} />;
  if (error) {
    if (isNotFound(error)) return <NoQuiz />;
    return (
      <Screen>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }
  return <SignedOut quest={quest} />;
}

function NoQuiz() {
  const t = useT();
  return (
    <Screen>
      <EmptyState title={t.quiz.noQuizTitle} body={t.common.checkBackNextEdition} />
    </Screen>
  );
}

function SignedIn({ quest }: { quest: Quest | undefined }) {
  const t = useT();
  const { data: overview, error, refetch } = useQuizOverview();
  const refreshQuest = useRefreshCurrentQuest();
  const refresh = useCallback(() => {
    void refetch();
    refreshQuest();
  }, [refetch, refreshQuest]);

  if (overview?.state === 'results') return <Navigate to="/results" replace />;
  if (!overview) {
    if (error) {
      return (
        <Screen>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Screen>
      );
    }
    return <LoadingState label={t.quiz.loading} />;
  }

  return (
    <Screen className="flex-1 justify-center gap-6">
      <OverviewCard overview={overview} quest={quest} onRefresh={refresh} />
    </Screen>
  );
}

function SignedOut({ quest }: { quest: Quest }) {
  const t = useT().quiz;
  const refreshQuest = useRefreshCurrentQuest();
  // Memoised on the ISO string — a fresh Date each render loops `useCountdown`.
  const target = useMemo(() => new Date(quest.quizOpensAt), [quest.quizOpensAt]);

  return (
    <Screen className="flex-1 justify-center gap-6">
      <header className="flex flex-col gap-1 text-center">
        <p className="type-label">{t.label}</p>
        <h1 className="type-display text-3xl text-paper">{t.comingTitle}</h1>
      </header>
      <Countdown label={t.opensIn} target={target} dateText={formatLongDate(quest.quizOpensAt)} onComplete={refreshQuest} />
      <Button to="/me" className="self-center">
        {t.signInToPlay}
      </Button>
    </Screen>
  );
}
