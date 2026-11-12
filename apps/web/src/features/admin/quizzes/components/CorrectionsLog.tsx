import type { QuizAdmin, QuizCorrectionEntry } from '@bookquest/shared';
import { useAuth } from '@/lib/auth/useAuth';
import { formatCompactDate } from '@/lib/format';
import { useT, type Messages } from '@/i18n';

/** "Question 4: answer changed from “Paris” to “Lyon”", read against the quiz as it stands now. */
function describe(entry: QuizCorrectionEntry, quiz: QuizAdmin, t: Messages['adminQuiz']['correction']): string {
  const index = quiz.questions.findIndex((q) => q.id === entry.questionId);
  const question = quiz.questions[index];
  const label = question ? t.logQuestion(index + 1) : t.logRemoved;
  if (entry.kind === 'void') return t.logVoided(label);
  const text = (id: string | null) => question?.options.find((o) => o.id === id)?.text ?? t.logNone;
  return t.logChanged(label, text(entry.from), text(entry.to));
}

/** Every correction on this quiz, newest first (§5.5). */
export function CorrectionsLog({ quiz }: { quiz: QuizAdmin }) {
  const { user } = useAuth();
  const t = useT().adminQuiz.correction;
  if (quiz.corrections.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="type-label m-0">{t.log}</h2>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {[...quiz.corrections].reverse().map((entry) => (
          <li
            key={`${entry.questionId}-${entry.at}`}
            className="flex flex-col gap-1 rounded-box border border-[color:var(--rule)] p-3 text-sm"
          >
            <span className="text-paper">{describe(entry, quiz, t)}</span>
            {entry.note && <span className="text-paper-dim">{entry.note}</span>}
            <span className="text-xs text-taupe">
              {formatCompactDate(entry.at)} · {t.logBy(entry.by === user?.id ? 'you' : 'admin')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
