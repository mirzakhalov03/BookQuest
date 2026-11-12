import { Button } from '@/components/ui/Button';
import { ProgressRail } from '@/components/quiz/ProgressRail';

interface BetweenScreenProps {
  index: number;
  total: number;
  busy: boolean;
  onContinue: () => void;
}

/** On resume, so a returning participant is never ambushed by a running clock (§4.2 step 7). */
export function BetweenScreen({ index, total, busy, onContinue }: BetweenScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <ProgressRail total={total} current={index} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <h1 className="type-display m-0 text-3xl text-paper">
          Question {index + 1} of {total} is ready
        </h1>
        <p className="m-0 max-w-sm text-taupe">The timer starts when you continue.</p>
        <Button type="button" className="w-full max-w-xs" disabled={busy} onClick={onContinue}>
          {busy ? 'Opening…' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
