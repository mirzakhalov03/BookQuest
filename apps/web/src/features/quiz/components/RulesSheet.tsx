import type { QuizOverview } from '@bookquest/shared';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { formatCount } from '@/lib/format';
import { useT } from '@/i18n';

interface RulesSheetProps {
  open: boolean;
  quiz: NonNullable<QuizOverview['quiz']> | null;
  busy: boolean;
  onClose: () => void;
  onReady: () => void;
}

/** The four rules (§4.2 step 1), shared by the sheet and the rules card so the wording lives once. */
export function RulesList({ quiz }: { quiz: RulesSheetProps['quiz'] }) {
  const t = useT();
  const rules = t.quiz.rules(quiz ? t.common.questions(quiz.questionCount, formatCount(quiz.questionCount)) : null);
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {rules.map((rule, i) => (
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
  const t = useT().quiz;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.beforeYouStart}
      actions={
        <>
          <Button type="button" variant="quiet" onClick={onClose}>
            {t.notYet}
          </Button>
          <Button type="button" disabled={busy} onClick={onReady}>
            {busy ? t.starting : t.ready}
          </Button>
        </>
      }
    >
      <RulesList quiz={quiz} />
    </Sheet>
  );
}
