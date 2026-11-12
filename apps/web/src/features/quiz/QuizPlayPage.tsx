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
import { QuizGuard } from './components/QuizGuard';
import { useOtherTabNotice } from './components/useOtherTabNotice';

// Matches `.quiz-q-leave` in styles/quiz.css.
const LEAVE_MS = 260;
// The closing "Submitting your answers…" stays at least this long, so it reads as a step, not a flicker.
const SUBMIT_MIN_MS = 1200;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The question on screen while it animates out (`leaving`), then a loader if the next is still on its
 * way (`waiting`), or after the last question, the submitting step before "Done" (`submitting`).
 */
type Hold = { question: AttemptQuestion; stage: 'leaving' | 'waiting' | 'submitting' };

/**
 * `/quiz/play` — renders whatever phase the server says. The only local state
 * is the hand-off hold and whether to move on by itself, which happens only
 * right after an answer or "I'm ready" in this session, never on a fresh load.
 */
export function QuizPlayPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { query, state, next, lock, select, flushSelection, pendingPick, refetch, failingSince } = useAttempt();

  // A session flag, seeded by "I'm ready"; the router state is cleared so a reload starts from the server's truth.
  const [autoAdvance, setAutoAdvance] = useState(() => (location.state as { autoStart?: boolean } | null)?.autoStart === true);
  const [advancing, setAdvancing] = useState(false);
  const [hold, setHold] = useState<Hold | null>(null);

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const phase = state?.phase;
  const total = state?.position.total ?? 0;
  const isLastQuestion = useCallback((target: AttemptQuestion) => target.index === total - 1, [total]);
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

  /**
   * Slides `target` out while `request` fetches what comes next, and shows the next question the moment
   * it lands: its clock is already running on the server, so the app never makes it wait for an animation.
   * A slow request shows a loader once the exit has played. After the last answer no clock runs, so the
   * submitting step may hold for a readable minimum.
   */
  const handOff = useCallback(async (target: AttemptQuestion, request: () => Promise<unknown>, last: boolean) => {
    setHold({ question: target, stage: 'leaving' });
    let landed = false;
    void sleep(LEAVE_MS).then(() => {
      if (!landed) setHold({ question: target, stage: last ? 'submitting' : 'waiting' });
    });
    try {
      await request();
    } finally {
      landed = true;
      if (last) {
        setHold({ question: target, stage: 'submitting' });
        await sleep(SUBMIT_MIN_MS);
      }
      // Whatever the outcome, the cache holds the server's state by now; just render it.
      setHold(null);
    }
  }, []);

  // One request answers and serves the next question; `autoAdvance` covers a reply that stops at `between`.
  const onContinue = useCallback(
    (target: AttemptQuestion, optionId: string, clientElapsedMs: number) => {
      haptic('reveal');
      setAutoAdvance(true);
      void handOff(
        target,
        () => lock({ index: target.index, body: { optionId, lock: true, next: true, clientElapsedMs, signals: readSignals() } }),
        isLastQuestion(target)
      );
    },
    [handOff, isLastQuestion, lock, readSignals]
  );

  const onSelect = useCallback(
    (target: AttemptQuestion, optionId: string) =>
      void select({ index: target.index, body: { optionId, lock: false, signals: readSignals() } }),
    [readSignals, select]
  );

  const onExpire = useCallback(
    async (target: AttemptQuestion, seenLive: boolean) => {
      // Opened onto a dead clock: a read settles it and lands on the between screen instead.
      if (!seenLive) return void refetch();
      // Watched it run out: input locks as the slide-out starts, every tap made reaches the server,
      // then `next` settles the question and serves the following one.
      setAutoAdvance(false);
      await handOff(
        target,
        async () => {
          await flushSelection();
          await next();
        },
        isLastQuestion(target)
      );
    },
    [flushSelection, handOff, isLastQuestion, next, refetch]
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

    if (hold?.stage === 'waiting') return <LoadingState label="Next question…" />;
    if (hold?.stage === 'submitting') return <LoadingState label="Submitting your answers…" className="quiz-q-enter" />;

    if (question) {
      return (
        <QuizGuard>
          <QuestionView
            key={`${question.index}:${question.deadlineAt}`}
            question={question}
            total={state.position.total}
            version={state.serverNow}
            leaving={hold !== null}
            initialPick={pendingPick(question.index)}
            onSelect={(optionId) => onSelect(question, optionId)}
            onContinue={(optionId, clientElapsedMs) => onContinue(question, optionId, clientElapsedMs)}
            onExpire={(seenLive) => void onExpire(question, seenLive)}
          />
        </QuizGuard>
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
        return <Completed closedEarly={Date.parse(state.serverNow) >= Date.parse(state.windowClosesAt)} />;
      case 'voided':
        return <Voided />;
    }
  }
}

function Completed({ closedEarly }: { closedEarly: boolean }) {
  const { data: quest } = useCurrentQuest();
  return <CompletionScreen resultsAt={quest?.resultsAt ?? null} closedEarly={closedEarly} />;
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
