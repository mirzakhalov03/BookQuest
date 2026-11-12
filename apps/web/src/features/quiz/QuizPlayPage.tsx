import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import type { AttemptQuestion } from '@bookquest/shared';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { isNotFound } from '@/lib/api/client';
import { useCurrentQuest } from '@/lib/api/quest';
import { getTelegramBackButton, haptic } from '@/lib/telegram';
import { useAttempt } from './api/useAttempt';
import { useQuizOverview } from './api/useQuizOverview';
import { useHiddenSignals } from './lib/useHiddenSignals';
import { BetweenScreen } from './components/BetweenScreen';
import { CompletionScreen } from './components/CompletionScreen';
import { ConnectionBanner } from './components/ConnectionBanner';
import { QuestionView } from './components/QuestionView';
import { useOtherTabNotice } from './components/useOtherTabNotice';

const LOCKED_IN_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `/quiz/play` — renders whatever phase the server says. The only local state
 * is the "Locked in" hold and whether to move on by itself, which happens only
 * right after a lock or "I'm ready" in this session, never on a fresh load.
 */
export function QuizPlayPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { query, state, next, lock, select, refetch, saveStatus, failingSince } = useAttempt();

  // A session flag, seeded by "I'm ready"; the router state is cleared so a reload starts from the server's truth.
  const [autoAdvance, setAutoAdvance] = useState(() => (location.state as { autoStart?: boolean } | null)?.autoStart === true);
  const [advancing, setAdvancing] = useState(false);
  const [hold, setHold] = useState<{ question: AttemptQuestion; optionId: string } | null>(null);

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const phase = state?.phase;
  const question = hold?.question ?? (phase === 'question' ? state?.question ?? null : null);
  const readSignals = useHiddenSignals(question ? String(question.index) : null);

  const advance = useCallback(async () => {
    setAutoAdvance(false);
    setAdvancing(true);
    await next();
    setAdvancing(false);
  }, [next]);

  // Move on by itself only when this session asked for it.
  useEffect(() => {
    if (hold || advancing) return;
    if (autoAdvance && (phase === 'between' || phase === 'ready')) void advance();
    else if (autoAdvance && phase === 'question') setAutoAdvance(false);
  }, [autoAdvance, advance, advancing, hold, phase]);

  const confirm = useCallback(
    async (target: AttemptQuestion, optionId: string) => {
      setHold({ question: target, optionId });
      setAutoAdvance(true);
      const outcome = await lock({ index: target.index, body: { optionId, lock: true, signals: readSignals() } });
      if (outcome === 'locked') {
        haptic('reveal');
        await sleep(LOCKED_IN_MS);
      }
      // Every other outcome already holds the server's state in the cache; just render it.
      setHold(null);
    },
    [lock, readSignals]
  );

  const onSelect = useCallback(
    (target: AttemptQuestion, optionId: string) =>
      void select({ index: target.index, body: { optionId, lock: false, signals: readSignals() } }),
    [readSignals, select]
  );

  const onExpire = useCallback(
    (seenLive: boolean) => {
      // Watched it run out: `next` settles it and serves the following question.
      // Opened onto a dead clock: a read settles it and lands on the between screen instead.
      if (seenLive) void advance();
      else void refetch();
    },
    [advance, refetch]
  );

  useQuestionBackButton(phase === 'question' || hold !== null);
  const otherTab = useOtherTabNotice(useCallback(() => void refetch(), [refetch]));

  return (
    <Screen className="flex-1 gap-4">
      <ConnectionBanner failingSince={failingSince} />
      {otherTab.show && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-paper/15 bg-ash px-4 py-3">
          <p className="m-0 text-sm text-paper-dim">The quiz is open in another tab — continue here?</p>
          <Button type="button" variant="quiet" className="min-h-10 px-3" onClick={otherTab.takeOver}>
            Continue here
          </Button>
        </div>
      )}
      {renderBody()}
    </Screen>
  );

  // A plain call, not a nested component: a new component type per render would remount the question.
  function renderBody() {
    if (!state) {
      if (query.error) {
        if (isNotFound(query.error)) return <Navigate to="/quiz" replace />;
        return <ErrorState error={query.error} onRetry={() => void refetch()} />;
      }
      return <LoadingState label="Opening your quiz…" />;
    }

    if (question) {
      return (
        <QuestionView
          key={`${question.index}:${question.deadlineAt}`}
          question={question}
          total={state.position.total}
          version={state.serverNow}
          lockedOptionId={hold?.optionId ?? null}
          saveStatus={saveStatus}
          onSelect={(optionId) => onSelect(question, optionId)}
          onConfirm={(optionId) => void confirm(question, optionId)}
          onExpire={onExpire}
        />
      );
    }

    switch (state.phase) {
      case 'ready':
      case 'between':
      case 'question':
        if (autoAdvance || advancing) return <LoadingState label="Next question…" />;
        return (
          <BetweenScreen
            index={state.position.index}
            total={state.position.total}
            busy={advancing}
            onContinue={() => void advance()}
          />
        );
      case 'completed':
        return <Completed closedEarly={Date.parse(state.serverNow) >= Date.parse(state.windowClosesAt)} result={state.result} />;
      case 'voided':
        return <Voided />;
    }
  }
}

function Completed({ result, closedEarly }: { result: NonNullable<ReturnType<typeof useAttempt>['state']>['result']; closedEarly: boolean }) {
  const { data: quest } = useCurrentQuest();
  if (!result) return <LoadingState label="Adding it up…" />;
  return <CompletionScreen result={result} resultsAt={quest?.resultsAt ?? null} closedEarly={closedEarly} />;
}

/** The attempt state carries no reason; the overview does. */
function Voided() {
  const { data } = useQuizOverview();
  const reason = data?.attempt?.voidReason;
  return (
    <EmptyState
      title="Attempt withdrawn"
      body={`Your attempt was withdrawn by the organisers.${reason ? ` Reason: ${reason}` : ''}`}
      action={<Button to="/quiz" variant="quiet">Back to the quiz</Button>}
    />
  );
}

/** No Telegram back button while a question is live; otherwise it leads back to `/quiz`. */
function useQuestionBackButton(live: boolean) {
  const navigate = useNavigate();
  useEffect(() => {
    const button = getTelegramBackButton();
    if (!button) return;
    if (live) {
      button.hide();
      return;
    }
    const back = () => navigate('/quiz');
    button.onClick(back);
    button.show();
    return () => {
      button.offClick(back);
      button.hide();
    };
  }, [live, navigate]);
}
