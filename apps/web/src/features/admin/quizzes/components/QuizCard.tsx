import { Copy, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import type { QuizSummaryAdmin } from '@bookquest/shared';
import { formatTimeAgo } from '@/lib/format';
import { formatQuizDuration } from '../format';

type Chip = { label: string; tone: 'warn' | 'good' | 'plain' };

function chipsFor(quiz: QuizSummaryAdmin): Chip[] {
  const chips: Chip[] = [
    quiz.isComplete ? { label: 'Ready', tone: 'good' } : { label: 'Incomplete', tone: 'warn' }
  ];
  if (quiz.attachment) {
    chips.push({
      label: `Attached to Edition ${quiz.attachment.questEdition} · ${quiz.attachment.groupLabel}`,
      tone: 'plain'
    });
  }
  if (quiz.locked) chips.push({ label: 'Locked', tone: 'plain' });
  return chips;
}

const TONE = {
  warn: 'border-amber/50 text-amber',
  good: 'border-[color:var(--rule-gold)] text-gold-soft',
  plain: 'border-[color:var(--rule)] text-taupe'
} as const;

interface QuizCardProps {
  quiz: QuizSummaryAdmin;
  busy: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function QuizCard({ quiz, busy, onDuplicate, onDelete }: QuizCardProps) {
  const { easy, medium, hard } = quiz.difficultyMix;
  const canDelete = !quiz.attachment && !quiz.locked;

  return (
    <li className="flex flex-col gap-3 rounded-box border border-[color:var(--rule)] bg-[color:var(--color-ash)] p-4">
      <div className="flex items-start gap-2">
        <Link to={`/admin/quizzes/${quiz.id}`} className="min-w-0 flex-1 text-paper hover:text-amber">
          <h2 className="type-display m-0 break-words text-lg">{quiz.title}</h2>
        </Link>
        <button
          type="button"
          aria-label={`Duplicate ${quiz.title}`}
          disabled={busy}
          onClick={onDuplicate}
          className="flex h-11 w-9 items-center justify-center text-taupe hover:text-paper disabled:opacity-40"
        >
          <Copy className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Delete ${quiz.title}`}
          disabled={busy || !canDelete}
          title={canDelete ? undefined : 'Attached or started quizzes can’t be deleted'}
          onClick={onDelete}
          className="flex h-11 w-9 items-center justify-center text-taupe hover:text-error disabled:opacity-30 disabled:hover:text-taupe"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="m-0 text-sm text-paper-dim">
        {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'} ·{' '}
        {formatQuizDuration(quiz.totalSeconds)} ·{' '}
        <span title="Easy · Medium · Hard">
          {easy}·{medium}·{hard}
        </span>
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {chipsFor(quiz).map(({ label, tone }) => (
          <li key={label} className={`rounded-full border px-2 py-0.5 text-xs ${TONE[tone]}`}>
            {label}
          </li>
        ))}
      </ul>
      <p className="m-0 text-xs text-taupe">Updated {formatTimeAgo(quiz.updatedAt)}</p>
    </li>
  );
}
