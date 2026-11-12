import type { QuizOverview } from '@bookquest/shared';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { formatCount } from '@/lib/format';

interface RulesSheetProps {
  open: boolean;
  quiz: NonNullable<QuizOverview['quiz']> | null;
  busy: boolean;
  onClose: () => void;
  onReady: () => void;
}

/** The four rules (§4.2 step 1). Also used as the rules card, so the wording lives once. */
export function quizRules(quiz: RulesSheetProps['quiz']): string[] {
  const count = quiz ? `${formatCount(quiz.questionCount)} questions` : 'A set of questions';
  return [
    `${count}, one at a time.`,
    'Each question has its own timer. When it runs out, the quiz moves on.',
    'No going back: a confirmed answer is final.',
    'The timer keeps running if you leave, so find a quiet moment first.'
  ];
}

export function RulesList({ quiz }: { quiz: RulesSheetProps['quiz'] }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {quizRules(quiz).map((rule, i) => (
        <li key={rule} className="flex gap-3 text-paper-dim">
          <span aria-hidden className="type-label mt-0.5 w-4 shrink-0 text-ember">
            {i + 1}
          </span>
          <span>{rule}</span>
        </li>
      ))}
    </ol>
  );
}

/** One confirm step before the clock starts: the only friction, and it stops an accidental start. */
export function RulesSheet({ open, quiz, busy, onClose, onReady }: RulesSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Before you start"
      actions={
        <>
          <Button type="button" variant="quiet" onClick={onClose}>
            Not yet
          </Button>
          <Button type="button" disabled={busy} onClick={onReady}>
            {busy ? 'Starting…' : "I'm ready"}
          </Button>
        </>
      }
    >
      <RulesList quiz={quiz} />
    </Sheet>
  );
}
