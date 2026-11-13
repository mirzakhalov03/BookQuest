import { Link } from 'react-router';
import { useId, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, X } from 'lucide-react';
import type { ReadinessCheck } from '../quizReadiness';
import { useT } from '@/i18n';

interface QuizReadinessListProps {
  checks: ReadinessCheck[];
  /** Problems start expanded when the quiz opens within a day; otherwise one summary line. */
  quizOpensAt: Date | null;
  onGoToDates: () => void;
}

const DAY_MS = 86_400_000;

const linkClass = 'min-h-11 text-sm text-amber underline-offset-2 hover:underline';

/** One status line, "Ready" or "N things to fix", that opens to the full checklist. Problems are never hidden, only folded. */
export function QuizReadinessList({ checks, quizOpensAt, onGoToDates }: QuizReadinessListProps) {
  const { quiz } = useT().adminQuest;
  const failing = checks.filter((check) => !check.ok).length;
  const [open, setOpen] = useState(
    () => failing > 0 && quizOpensAt !== null && quizOpensAt.getTime() - Date.now() < DAY_MS
  );
  const listId = useId();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className={`inline-flex min-h-11 items-center gap-2 self-start text-sm ${failing ? 'text-amber' : 'text-gold-soft'}`}
      >
        {failing ? (
          <AlertTriangle aria-hidden className="h-4 w-4" />
        ) : (
          <Check aria-hidden className="h-4 w-4" />
        )}
        {failing ? quiz.toFix(failing) : quiz.ready}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 text-taupe transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <ChecklistItems id={listId} checks={checks} onGoToDates={onGoToDates} />}
    </div>
  );
}

function ChecklistItems({
  id,
  checks,
  onGoToDates
}: {
  id: string;
  checks: ReadinessCheck[];
  onGoToDates: () => void;
}) {
  const t = useT().adminQuest.readiness;
  return (
    <ul id={id} aria-label={t.aria} className="m-0 flex list-none flex-col gap-3 p-0">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-3">
          {check.ok ? (
            <Check aria-label={t.passed} className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
          ) : (
            <X aria-label={t.needsFixing} className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          )}
          <div className="flex min-w-0 flex-col">
            <span className={check.ok ? 'text-paper-dim' : 'text-paper'}>{check.label}</span>
            {!check.ok && check.detail && (
              <span className="text-sm text-taupe">{check.detail}</span>
            )}
            {!check.ok && check.fixes.length > 0 && (
              <span className="flex flex-wrap gap-x-4">
                {check.fixes.map((fix) =>
                  fix.to ? (
                    <Link
                      key={fix.label}
                      to={fix.to}
                      className={`${linkClass} inline-flex items-center`}
                    >
                      {fix.label}
                    </Link>
                  ) : (
                    <button
                      key={fix.label}
                      type="button"
                      onClick={onGoToDates}
                      className={`${linkClass} text-left`}
                    >
                      {fix.label}
                    </button>
                  )
                )}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
