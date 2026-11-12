import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { QUIZ_ANSWER_GRACE_MS, type AttemptQuestion } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { ProgressRail } from '@/components/quiz/ProgressRail';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { QuestionTimer } from '@/components/quiz/QuestionTimer';
import { useCountdownTo } from '@/components/quiz/useCountdownTo';
import { haptic } from '@/lib/telegram';
import type { SaveStatus } from '../api/useAttempt';
import { serverNow } from '../lib/serverClock';

const TIME_UP_MS = 600;
// The server settles an expired question only after deadline + grace; asking sooner returns it unchanged.
const SETTLE_MARGIN_MS = 250;
const WATCHED_WITHIN_MS = 1000;

interface QuestionViewProps {
  question: AttemptQuestion;
  total: number;
  /** Changes on every server response, so an unchanged question re-arms the time-up step. */
  version: string;
  /** Set while "Locked in" holds the screen. */
  lockedOptionId: string | null;
  saveStatus: SaveStatus;
  onSelect: (optionId: string) => void;
  onConfirm: (optionId: string) => void;
  /** Once per expiry, after "Time's up" has shown. `seenLive`: the clock ran out on screen, not while hidden. */
  onExpire: (seenLive: boolean) => void;
}

export function QuestionView({
  question,
  total,
  version,
  lockedOptionId,
  saveStatus,
  onSelect,
  onConfirm,
  onExpire
}: QuestionViewProps) {
  const deadlineMs = Date.parse(question.deadlineAt);
  const remaining = useCountdownTo(deadlineMs, serverNow);
  const locked = lockedOptionId !== null;
  const timeUp = remaining === 0 && !locked;

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
  if (remaining > 0 && document.visibilityState === 'visible') lastLiveFrame.current = serverNow();
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') lastLiveFrame.current = null;
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
  const watchedRunOut = () =>
    lastLiveFrame.current !== null && deadlineMs - lastLiveFrame.current <= WATCHED_WITHIN_MS;

  const latest = useRef({ onExpire, onConfirm, picked, disabled: locked || timeUp });
  latest.current = { onExpire, onConfirm, picked, disabled: locked || timeUp };

  // At 0: "Time's up" for at least 600 ms and until the server will have settled it.
  useEffect(() => {
    if (!timeUp) return;
    const wait = Math.max(TIME_UP_MS, deadlineMs + QUIZ_ANSWER_GRACE_MS + SETTLE_MARGIN_MS - serverNow());
    const id = window.setTimeout(() => latest.current.onExpire(watchedRunOut()), wait);
    return () => window.clearTimeout(id);
  }, [timeUp, deadlineMs, version]);

  // One soft tick at 5 s (§6).
  const seconds = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (seconds === 5 && lastLiveFrame.current !== null) haptic('select');
  }, [seconds]);

  // Enter confirms, unless it is activating a control that means something else (an unselected option).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.defaultPrevented) return;
      const { picked: current, disabled } = latest.current;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('button, a, input, textarea, select') && target.getAttribute('aria-pressed') !== 'true') return;
      if (disabled || !current) return;
      event.preventDefault();
      latest.current.onConfirm(current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const pick = (optionId: string) => {
    if (locked || timeUp) return;
    setPicked(optionId);
    onSelect(optionId);
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <ProgressRail total={total} current={question.index} />
        </div>
        <QuestionTimer remainingMs={remaining} totalMs={question.timeLimitMs} />
      </div>

      <QuestionCard
        question={card}
        selectedOptionId={picked}
        lockedOptionId={lockedOptionId}
        disabled={locked || timeUp}
        onSelect={pick}
      />

      <StatusLine timeUp={timeUp} locked={locked} saveStatus={saveStatus} />

      {/* Sticky so Confirm stays under the thumb on long questions. */}
      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-ink via-ink/95 to-transparent pb-[calc(1rem+var(--safe-b))] pt-4">
        <Button
          type="button"
          className="w-full"
          disabled={!picked || locked || timeUp}
          onClick={() => picked && onConfirm(picked)}
        >
          {locked ? 'Locked in' : 'Confirm'}
        </Button>
      </div>
    </div>
  );
}

function StatusLine({ timeUp, locked, saveStatus }: { timeUp: boolean; locked: boolean; saveStatus: SaveStatus }) {
  const [text, tone] = timeUp
    ? ["Time's up", 'text-amber']
    : locked
      ? ['Locked in', 'text-ember']
      : saveStatus === 'saving'
        ? ['Saving…', 'text-taupe']
        : saveStatus === 'retrying'
          ? ['Offline — retrying', 'text-amber']
          : saveStatus === 'saved'
            ? ['Saved', 'text-taupe']
            : ['', ''];

  return (
    <p role="status" aria-live="polite" className={`m-0 flex min-h-5 items-center gap-1.5 text-sm ${tone}`}>
      {text === 'Saved' && <Check aria-hidden className="h-4 w-4" />}
      {text}
    </p>
  );
}
