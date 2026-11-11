import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { effectiveTimeLimitSec } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { ProgressRail } from '@/components/quiz/ProgressRail';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { QuestionTimer } from '@/components/quiz/QuestionTimer';
import { useCountdownTo } from '@/components/quiz/useCountdownTo';
import { useQuiz } from '../api/useQuizzes';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminQuery } from '../components/AdminQuery';
import { readDraft, toQuizFormState, type QuizFormState } from './quizForm';

type AnswersMode = 'hidden' | 'shown';

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
  const [answers, setAnswers] = useState<AnswersMode>('hidden');
  const [selected, setSelected] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(() =>
    questions[0] ? Date.now() + effectiveTimeLimitSec(questions[0], settings) * 1000 : null
  );
  const remaining = useCountdownTo(deadline, readNow);

  const question = questions[index];
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
        <AdminPageHeader eyebrow="Preview" title={content.title} />
        <p className="m-0 text-taupe">This quiz has no questions yet.</p>
        <BackLink {...backToEditor} />
      </AdminScreen>
    );
  }

  const totalMs = effectiveTimeLimitSec(question, settings) * 1000;
  const timeUp = deadline !== null && remaining === 0;

  return (
    <AdminScreen className="max-w-2xl">
      <AdminPageHeader
        eyebrow="Preview · nothing is saved"
        title={content.title}
        titleClassName="text-2xl"
        actions={
          <Switch
            aria-label="Show answers"
            options={[
              { value: 'hidden', label: 'Hide answers' },
              { value: 'shown', label: 'Show answers' }
            ]}
            value={answers}
            onChange={setAnswers}
          />
        }
      />

      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <ProgressRail total={questions.length} current={index} />
        </div>
        <QuestionTimer remainingMs={remaining} totalMs={totalMs} />
      </div>

      <QuestionCard
        question={{
          type: question.type,
          prompt: question.prompt || 'Untitled question',
          options: question.options.map((option) => ({ ...option, text: option.text || 'Empty option' }))
        }}
        selectedOptionId={selected}
        revealCorrectOptionId={answers === 'shown' ? question.correctOptionId : null}
        disabled={timeUp}
        onSelect={setSelected}
      />

      {timeUp && (
        <p className="m-0 text-amber">Time's up. Participants move on automatically; here you can restart the clock.</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="quiet" disabled={index === 0} onClick={() => startQuestion(index - 1)} className="min-h-11 px-3">
          Back
        </Button>
        <Button type="button" variant="quiet" onClick={() => startQuestion(index)} className="min-h-11 gap-2 px-3">
          <RotateCcw className="h-4 w-4" aria-hidden /> Restart timer
        </Button>
        <Button type="button" disabled={index === questions.length - 1} onClick={() => startQuestion(index + 1)} className="min-h-11 px-5">
          Next
        </Button>
      </div>

      <BackLink {...backToEditor} />
    </AdminScreen>
  );
}

function BackLink({ to, state }: { to: string; state: { draft: QuizFormState } }) {
  return (
    <Button to={to} state={state} variant="quiet" className="min-h-11 gap-2 self-start px-0">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to editor
    </Button>
  );
}
