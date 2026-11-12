import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { effectiveTimeLimitSec } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { Button } from '@/components/ui/Button';
import { ProgressRail } from '@/components/quiz/ProgressRail';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { QuestionTimer } from '@/components/quiz/QuestionTimer';
import { useCountdownTo } from '@/components/quiz/useCountdownTo';
import { useQuiz } from '../api/useQuizzes';
import { AdminQuery } from '../components/AdminQuery';
import { readDraft, toQuizFormState, type QuizFormState } from './quizForm';

// 44px squares: the preview's controls are icons, named for screen readers by `aria-label`.
const ICON_BASE =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-box border transition-colors disabled:opacity-30';
const ICON_BUTTON = `${ICON_BASE} border-[color:var(--rule)] text-paper-dim hover:text-paper`;
const ICON_BUTTON_ON = `${ICON_BASE} border-gold/50 text-gold-soft`;

/** `/admin/quizzes/:id/preview` — step through a quiz as a participant sees it. Writes nothing. */
export function QuizPreviewPage() {
  const { id = '' } = useParams();
  const draft = readDraft(useLocation().state);

  // Unsaved edits from the editor win; a direct visit falls back to the saved quiz.
  if (draft) return <Preview quizId={id} content={draft} />;
  return <SavedPreview quizId={id} />;
}

function SavedPreview({ quizId }: { quizId: string }) {
  const query = useQuiz(quizId);
  return (
    <AdminQuery query={query} loadingLabel="Opening the preview…">
      {(quiz) => <Preview quizId={quizId} content={toQuizFormState(quiz)} />}
    </AdminQuery>
  );
}

const readNow = () => Date.now();

function Preview({ quizId, content }: { quizId: string; content: QuizFormState }) {
  const { questions, settings } = content;
  const [index, setIndex] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(() =>
    questions[0] ? Date.now() + effectiveTimeLimitSec(questions[0], settings) * 1000 : null
  );
  const remaining = useCountdownTo(deadline, readNow);

  const question = questions[index];
  // Stable identity: the timer re-renders this every frame.
  const cardQuestion = useMemo(
    () =>
      question && {
        type: question.type,
        prompt: question.prompt || 'Untitled question',
        options: question.options.map((option) => ({ ...option, text: option.text || 'Empty option' }))
      },
    [question]
  );
  const backToEditor = { to: `/admin/quizzes/${quizId}`, state: { draft: content } };

  function startQuestion(next: number) {
    const target = questions[next];
    if (!target) return;
    setIndex(next);
    setSelected(null);
    setDeadline(Date.now() + effectiveTimeLimitSec(target, settings) * 1000);
  }

  if (!question) {
    return (
      <AdminScreen className="max-w-2xl">
        <PreviewHeader title={content.title} backToEditor={backToEditor} />
        <p className="m-0 text-taupe">This quiz has no questions yet.</p>
      </AdminScreen>
    );
  }

  const totalMs = effectiveTimeLimitSec(question, settings) * 1000;
  const timeUp = deadline !== null && remaining === 0;

  return (
    <AdminScreen className="max-w-2xl gap-5">
      <PreviewHeader
        title={content.title}
        backToEditor={backToEditor}
        action={
          <button
            type="button"
            aria-label="Show answers"
            aria-pressed={showAnswers}
            onClick={() => setShowAnswers((shown) => !shown)}
            className={showAnswers ? ICON_BUTTON_ON : ICON_BUTTON}
          >
            {showAnswers ? <Eye className="h-5 w-5" aria-hidden /> : <EyeOff className="h-5 w-5" aria-hidden />}
          </button>
        }
      />

      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <ProgressRail total={questions.length} current={index} />
        </div>
        <QuestionTimer remainingMs={remaining} totalMs={totalMs} />
      </div>

      <QuestionCard
        question={cardQuestion!}
        selectedOptionId={selected}
        revealCorrectOptionId={showAnswers ? question.correctOptionId : null}
        disabled={timeUp}
        onSelect={setSelected}
      />

      {timeUp && <p className="m-0 text-sm text-amber">Time's up — participants move on automatically.</p>}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Previous question"
          disabled={index === 0}
          onClick={() => startQuestion(index - 1)}
          className={ICON_BUTTON}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" aria-label="Restart timer" onClick={() => startQuestion(index)} className={ICON_BUTTON}>
          <RotateCcw className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </button>
        <Button
          type="button"
          aria-label="Next question"
          disabled={index === questions.length - 1}
          onClick={() => startQuestion(index + 1)}
          className="w-11 px-0"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </AdminScreen>
  );
}

interface PreviewHeaderProps {
  title: string;
  backToEditor: { to: string; state: { draft: QuizFormState } };
  action?: ReactNode;
}

/** One quiet row: way back, what this is, the answers toggle. The title matters less once you're inside. */
function PreviewHeader({ title, backToEditor, action }: PreviewHeaderProps) {
  return (
    <header className="flex items-center gap-3">
      <Link to={backToEditor.to} state={backToEditor.state} aria-label="Back to editor" className={ICON_BUTTON}>
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="type-label">Preview · not saved</span>
        <h1 className="m-0 truncate text-base font-semibold text-paper">{title}</h1>
      </div>
      {action}
    </header>
  );
}
