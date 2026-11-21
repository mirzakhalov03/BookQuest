import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n';

interface RulesSheetProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onReady: () => void;
}

/** The four rules (§4.2 step 1), shared by the sheet and the rules card so the wording lives once. */
export function RulesList() {
  const rules = useT().quiz.rules;
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

/** The rules on the quiz page itself, before anyone presses start. */
export function RulesCard() {
  const t = useT().quiz;
  return (
    <div className="rounded-box border border-paper/10 bg-ash/60 p-4 text-left">
      <p className="type-label mb-3">{t.howItWorks}</p>
      <RulesList />
    </div>
  );
}

/** One confirm step before the clock starts: the only friction, and it stops an accidental start. */
export function RulesSheet({ open, busy, onClose, onReady }: RulesSheetProps) {
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
      <RulesList />
    </Sheet>
  );
}
