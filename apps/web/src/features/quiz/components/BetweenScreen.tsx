import { Button } from '@/components/ui/Button';
import { ProgressRail } from '@/components/quiz/ProgressRail';
import { useT } from '@/i18n';

interface BetweenScreenProps {
  index: number;
  total: number;
  busy: boolean;
  onContinue: () => void;
}

/** On resume, so a returning participant is never ambushed by a running clock (§4.2 step 7). */
export function BetweenScreen({ index, total, busy, onContinue }: BetweenScreenProps) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col gap-8">
      <ProgressRail total={total} current={index} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <h1 className="type-display m-0 text-3xl text-paper">{t.quiz.questionReady(index + 1, total)}</h1>
        <p className="m-0 max-w-sm text-taupe">{t.quiz.timerStarts}</p>
        <Button type="button" className="w-full max-w-xs" disabled={busy} onClick={onContinue}>
          {busy ? t.quiz.openingQuestion : t.common.continue}
        </Button>
      </div>
    </div>
  );
}
