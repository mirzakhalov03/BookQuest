import { useFormContext, useWatch } from 'react-hook-form';
import { findQuizIssues, quizShape } from '@bookquest/shared';
import { formatQuizDuration } from '../format';
import type { QuizFormState } from '../quizForm';

/** Live shape and completeness, sticky above the save bar (§5.2). */
export function QuizSummaryBar({ raised }: { raised: boolean }) {
  const { control } = useFormContext<QuizFormState>();
  const [settings, questions] = useWatch({ control, name: ['settings', 'questions'] });
  const content = { settings, questions };
  const shape = quizShape(content);
  const issueCount = Object.keys(findQuizIssues(content) ?? {}).length;

  return (
    <div
      className={`sticky z-[4] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-box border border-[color:var(--rule)] bg-[color:var(--color-ink)] px-4 py-2.5 text-sm ${
        raised
          ? 'bottom-[calc(var(--tabbar-h)+var(--safe-b)+4.25rem)]'
          : 'bottom-[calc(var(--tabbar-h)+var(--safe-b)+0.5rem)]'
      }`}
    >
      <p className="m-0 text-paper-dim">
        {shape.questionCount} {shape.questionCount === 1 ? 'question' : 'questions'} ·{' '}
        {formatQuizDuration(shape.totalSeconds)} · Easy {shape.difficulty.easy} · Medium{' '}
        {shape.difficulty.medium} · Hard {shape.difficulty.hard}
      </p>
      <p className={`m-0 font-medium ${issueCount > 0 ? 'text-amber' : 'text-gold-soft'}`}>
        {issueCount > 0 ? `${issueCount} to fix before it can be used` : 'Ready'}
      </p>
    </div>
  );
}
