import { Link } from 'react-router';
import { Check, X } from 'lucide-react';
import type { ReadinessCheck } from '../quizReadiness';
import { useT } from '@/i18n';

interface QuizReadinessListProps {
  checks: ReadinessCheck[];
  onGoToDates: () => void;
}

const linkClass = 'min-h-11 text-sm text-amber underline-offset-2 hover:underline';

export function QuizReadinessList({ checks, onGoToDates }: QuizReadinessListProps) {
  const t = useT().adminQuest.readiness;
  return (
    <ul aria-label={t.aria} className="m-0 flex list-none flex-col gap-3 p-0">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-3">
          {check.ok ? (
            <Check aria-label={t.passed} className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
          ) : (
            <X aria-label={t.needsFixing} className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          )}
          <div className="flex min-w-0 flex-col">
            <span className={check.ok ? 'text-paper-dim' : 'text-paper'}>{check.label}</span>
            {!check.ok && check.detail && <span className="text-sm text-taupe">{check.detail}</span>}
            {!check.ok && check.fixes.length > 0 && (
              <span className="flex flex-wrap gap-x-4">
                {check.fixes.map((fix) =>
                  fix.to ? (
                    <Link key={fix.label} to={fix.to} className={`${linkClass} inline-flex items-center`}>
                      {fix.label}
                    </Link>
                  ) : (
                    <button key={fix.label} type="button" onClick={onGoToDates} className={`${linkClass} text-left`}>
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
