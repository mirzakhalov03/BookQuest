import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { QUIZ_ANSWER_GRACE_MS, type AttemptQuestion } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { ProgressRail } from '@/components/quiz/ProgressRail';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { QuestionTimer } from '@/components/quiz/QuestionTimer';
import { useCountdownTo } from '@/components/quiz/useCountdownTo';
import { haptic } from '@/lib/telegram';
import type { SaveStatus } from '../api/useAttempt';
import { serverNow } from '../lib/serverClock';

// Long enough to read "Time's up" before the question slides away.
const TIME_UP_MS = 900;
// A save that lands faster than this never flashes "Saving…".
const SAVING_LABEL_DELAY_MS = 300;
// The server settles an expired question only after deadline + grace; asking sooner returns it unchanged.
const SETTLE_MARGIN_MS = 250;
const WATCHED_WITHIN_MS = 1000;

interface QuestionViewProps {
  question: AttemptQuestion;
  total: number;
  /** Changes on every server response, so an unchanged question re-arms the time-up step. */
  version: string;
  /** Set while this question animates out for the next one. */
  leaving: boolean;
  saveStatus: SaveStatus;
  onSelect: (optionId: string) => void;
  /** Answers and moves on in one step. */
  onContinue: (optionId: string) => void;
  /** Once per expiry, after "Time's up" has shown. `seenLive`: the clock ran out on screen, not while hidden. */
  onExpire: (seenLive: boolean) => void;
}

export function QuestionView({
  question,
  total,
  version,
  leaving,
  saveStatus,
  onSelect,
  onContinue,
  onExpire
}: QuestionViewProps) {
  const deadlineMs = Date.parse(question.deadlineAt);
  const remaining = useCountdownTo(deadlineMs, serverNow);
  const timeUp = remaining === 0;
  const disabled = leaving || timeUp;
  const isLast = question.index === total - 1;

  // Optimistic highlight; follows the server when it learns of a selection we didn't make (another tab).
  const [picked, setPicked] = useState(question.selectedOptionId);
  const saving = saveStatus === 'saving' || saveStatus === 'retrying';
  useEffect(() => {
    if (!saving) setPicked(question.selectedOptionId);
    // Only a server change should overwrite the local pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.selectedOptionId]);

  // Stable identity: the timer re-renders this every frame.
  const card = useMemo(
    () => ({ type: question.type, prompt: question.prompt, options: question.options }),
    [question.type, question.prompt, question.options]
  );

  // Last visible frame with time left. A run-out only counts as watched if it came within a second of
  // the deadline; a tab returning from the background jumps to 0 and must take the refetch path instead.
  const lastLiveFrame = useRef<number | null>(null);
  // `remaining` can be stale on a render before the first rAF after a freeze, so re-check the clock itself.
  const frameAt = serverNow();
  if (remaining > 0 && frameAt < deadlineMs && document.visibilityState === 'visible') lastLiveFrame.current = frameAt;
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') lastLiveFrame.current = null;
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
  const watchedRunOut = () =>
    lastLiveFrame.current !== null &&
    lastLiveFrame.current <= deadlineMs &&
    deadlineMs - lastLiveFrame.current <= WATCHED_WITHIN_MS;

  const latest = useRef({ onExpire, onContinue, picked, disabled });
  latest.current = { onExpire, onContinue, picked, disabled };

  // At 0: "Time's up" briefly, then the page flushes saves and moves on. Opened onto a dead clock
  // (back from the background), the server settles it only after the grace, so wait that out.
  useEffect(() => {
    if (!timeUp || leaving) return;
    const watched = watchedRunOut();
    const wait = watched
      ? TIME_UP_MS
      : Math.max(TIME_UP_MS, deadlineMs + QUIZ_ANSWER_GRACE_MS + SETTLE_MARGIN_MS - serverNow());
    const id = window.setTimeout(() => latest.current.onExpire(watched), wait);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp, leaving, deadlineMs, version]);

  // One soft tick at 5 s (§6).
  const seconds = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (seconds === 5 && lastLiveFrame.current !== null) haptic('select');
  }, [seconds]);

  // Enter continues, unless it is activating a control that means something else (an unselected option).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.defaultPrevented) return;
      const { picked: current, disabled } = latest.current;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('button, a, input, textarea, select') && target.getAttribute('aria-pressed') !== 'true') return;
      if (disabled || !current) return;
      event.preventDefault();
      latest.current.onContinue(current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const pick = (optionId: string) => {
    if (disabled) return;
    setPicked(optionId);
    onSelect(optionId);
  };

  return (
    <div className={`flex flex-1 flex-col gap-6 ${leaving ? 'quiz-q-leave' : 'quiz-q-enter'}`}>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <ProgressRail total={total} current={question.index} />
        </div>
        <QuestionTimer remainingMs={remaining} totalMs={question.timeLimitMs} />
      </div>

      <QuestionCard
        question={card}
        selectedOptionId={picked}
        disabled={disabled}
        onSelect={pick}
      />

      <StatusLine timeUp={timeUp} saveStatus={saveStatus} picked={picked} serverPick={question.selectedOptionId} />

      {/* Sticky so Continue stays under the thumb on long questions. */}
      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-ink via-ink/95 to-transparent pb-[calc(1rem+var(--safe-b))] pt-4">
        <Button type="button" className="w-full" disabled={!picked || disabled} onClick={() => picked && onContinue(picked)}>
          {!picked ? 'Choose an answer' : isLast ? 'Finish' : 'Continue'}
          {picked && !isLast && <ArrowRight aria-hidden className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

interface StatusLineProps {
  timeUp: boolean;
  saveStatus: SaveStatus;
  picked: string | null;
  /** What the server holds; equal to `picked` means this pick is safe even without a fresh "saved". */
  serverPick: string | null;
}

function StatusLine({ timeUp, saveStatus, picked, serverPick }: StatusLineProps) {
  const saving = saveStatus === 'saving' || saveStatus === 'retrying';
  const saved = picked !== null && (saveStatus === 'saved' || (!saving && serverPick === picked));
  const showSaving = useDelayed(saveStatus === 'saving', SAVING_LABEL_DELAY_MS);

  const [text, tone, tick] = timeUp
    ? !picked
      ? ["Time's up", 'text-amber', false]
      : saving
        ? ["Time's up — saving your answer…", 'text-amber', false]
        : saved
          ? ["Time's up · your answer was saved", 'text-taupe', true]
          : ["Time's up", 'text-amber', false]
    : saveStatus === 'retrying'
      ? ['Offline — retrying', 'text-amber', false]
      : saving
        ? [showSaving ? 'Saving…' : '', 'text-taupe', false]
        : saved
          ? ['Saved', 'text-taupe', true]
          : ['', '', false];

  return (
    <p role="status" aria-live="polite" className={`m-0 flex min-h-5 items-center gap-1.5 text-sm ${tone}`}>
      {tick && <Check aria-hidden className="h-4 w-4" />}
      {text}
    </p>
  );
}

/** True once `flag` has held for `ms`; false again the moment it drops. */
function useDelayed(flag: boolean, ms: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) return setShown(false);
    const id = window.setTimeout(() => setShown(true), ms);
    return () => window.clearTimeout(id);
  }, [flag, ms]);
  return shown;
}
