import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { QUIZ_ANSWER_GRACE_MS, type AttemptQuestion } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { ProgressRail } from '@/components/quiz/ProgressRail';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { QuestionTimer } from '@/components/quiz/QuestionTimer';
import { useCountdownTo } from '@/components/quiz/useCountdownTo';
import { haptic } from '@/lib/telegram';
import { serverNow } from '../lib/serverClock';

// Taps still count this long after the ring hits 0 (the server accepts them within its grace),
// so a finger landing on the last frame is never thrown away.
const TAP_TOLERANCE_MS = 700;
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
  /** A tap this device made that the server may not hold yet; wins over `question.selectedOptionId`. */
  initialPick: string | null;
  onSelect: (optionId: string) => void;
  /** Answers and moves on in one step; `clientElapsedMs` is this screen's own time on the question. */
  onContinue: (optionId: string, clientElapsedMs: number) => void;
  /** Once per expiry, after "Time's up" has shown. `seenLive`: the clock ran out on screen, not while hidden. */
  onExpire: (seenLive: boolean) => void;
}

export function QuestionView({
  question,
  total,
  version,
  leaving,
  initialPick,
  onSelect,
  onContinue,
  onExpire
}: QuestionViewProps) {
  const deadlineMs = Date.parse(question.deadlineAt);
  const remaining = useCountdownTo(deadlineMs, serverNow);
  const timeUp = remaining === 0;
  const isLast = question.index === total - 1;

  // Live from the first frame (its clock is running). Not disabled at 0 either: taps keep counting until
  // the question actually leaves (TAP_TOLERANCE_MS). A double-tap on Continue lands on the next
  // question's Continue, disabled until something is picked, never on an option.
  const disabled = leaving;

  // The screen always shows this device's last tap; a slower server echo of an older tap never overrides it.
  const [picked, setPicked] = useState(initialPick ?? question.selectedOptionId);
  useEffect(() => {
    // Only fills in a selection made elsewhere (another tab) when this device hasn't picked.
    setPicked((current) => current ?? question.selectedOptionId);
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

  // On-screen time, from the first painted frame: monotonic, so a device clock change can't skew it.
  // The server counts it only within its refund window (QUIZ_LATENCY_REFUND_MAX_MS).
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => (shownAt.current ??= performance.now()));
    return () => cancelAnimationFrame(id);
  }, []);
  const submit = (optionId: string) =>
    onContinue(optionId, Math.round(performance.now() - (shownAt.current ?? performance.now())));

  const latest = useRef({ onExpire, submit, picked, disabled });
  latest.current = { onExpire, submit, picked, disabled };

  // At 0: a short tap tolerance, then the page flushes saves and moves on. Opened onto a dead clock
  // (back from the background), the server settles it only after the grace, so wait that out.
  useEffect(() => {
    if (!timeUp || leaving) return;
    const watched = watchedRunOut();
    const wait = watched
      ? TAP_TOLERANCE_MS
      : Math.max(TAP_TOLERANCE_MS, deadlineMs + QUIZ_ANSWER_GRACE_MS + SETTLE_MARGIN_MS - serverNow());
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
      latest.current.submit(current);
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

      {/* Sticky so Continue stays under the thumb on long questions. */}
      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-ink via-ink/95 to-transparent pb-[calc(1rem+var(--safe-b))] pt-4">
        <Button type="button" className="w-full" disabled={!picked || disabled} onClick={() => picked && submit(picked)}>
          {!picked ? 'Choose an answer' : isLast ? 'Finish' : 'Continue'}
          {picked && !isLast && <ArrowRight aria-hidden className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
