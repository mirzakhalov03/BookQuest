import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { QuizOverview } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { errorMessage } from '@/lib/api/errorMessage';
import { ApiRequestError } from '@/lib/api/client';
import { haptic } from '@/lib/telegram';
import { useCountdown } from '@/hooks/useCountdown';
import { useUiStore } from '@/stores/ui.store';
import { formatLongDate } from '@/lib/format';
import { useStartAttempt } from '../api/useAttempt';
import { serverNow } from '../lib/serverClock';
import { RulesSheet } from './RulesSheet';
import { useT } from '@/i18n';

interface StartCtaProps {
  window: NonNullable<QuizOverview['window']>;
  quiz: QuizOverview['quiz'];
  onWindowChange: () => void;
}

/** The `open` hero (§6): readiness should be unmistakable. */
export function StartCta({ window: quizWindow, quiz, onWindowChange }: StartCtaProps) {
  const navigate = useNavigate();
  const t = useT().quiz;
  const showToast = useUiStore((s) => s.showToast);
  const start = useStartAttempt();
  const [rulesOpen, setRulesOpen] = useState(false);

  const closesAt = useMemo(() => new Date(quizWindow.closesAt), [quizWindow.closesAt]);
  // Ticks this component each second, so the late-start warning appears on time.
  useCountdown(closesAt);
  const leftMs = closesAt.getTime() - serverNow();
  const lateStart = quiz !== null && leftMs < quiz.totalSeconds * 1000;
  const leftMin = Math.max(1, Math.ceil(leftMs / 60_000));

  const begin = () => {
    haptic('action');
    start.mutate(undefined, {
      // Router state, not a flag in storage: a reload of /quiz/play must not auto-serve.
      onSuccess: () => navigate('/quiz/play', { state: { autoStart: true } }),
      onError: (error) => {
        setRulesOpen(false);
        showToast(error instanceof ApiRequestError ? errorMessage(error) : t.startFailed);
        onWindowChange();
      }
    });
  };

  return (
    <section className="flex flex-col items-center gap-5 text-center">
      <p className="type-label text-ember">{t.isOpen}</p>
      <Button
        type="button"
        className="min-h-16 w-full max-w-xs animate-breathe text-lg motion-reduce:animate-none"
        onClick={() => setRulesOpen(true)}
      >
        {t.start}
      </Button>
      {lateStart && (
        <p role="note" className="m-0 max-w-sm text-amber">
          {t.lateStart(leftMin)}
        </p>
      )}
      <Countdown label={t.closesIn} target={closesAt} dateText={formatLongDate(closesAt)} onComplete={onWindowChange} />
      <RulesSheet open={rulesOpen} quiz={quiz} busy={start.isPending} onClose={() => setRulesOpen(false)} onReady={begin} />
    </section>
  );
}
