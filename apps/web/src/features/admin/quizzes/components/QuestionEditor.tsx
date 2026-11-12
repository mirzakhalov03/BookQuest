import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Ban, PencilLine, Trash2 } from 'lucide-react';
import {
  QUESTION_DIFFICULTIES,
  QUIZ_TEXT_LIMITS,
  QUIZ_TIME_LIMIT_SEC,
  type QuestionDifficulty,
  type QuestionType
} from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { TextArea } from '@/components/ui/TextArea';
import { optionsFor, type QuizFormState } from '../quizForm';
import { CharCount } from './CharCount';
import { OptionsEditor } from './OptionsEditor';

const TYPE_OPTIONS = [
  { value: 'true_false', label: 'True / False' },
  { value: 'mcq', label: 'Multiple choice' }
] as const;

const DIFFICULTY_OPTIONS = QUESTION_DIFFICULTIES.map((value) => ({
  value,
  label: value[0]!.toUpperCase() + value.slice(1)
}));

interface QuestionEditorProps {
  index: number;
  /** Live completeness messages for this question, keyed by field. */
  issues: Record<string, string>;
  onRemove: () => void;
  /** Participants have started: content is read-only and only a correction can change it. */
  locked: boolean;
  voided: boolean;
  onCorrect: () => void;
}

export function QuestionEditor({ index, issues, onRemove, locked, voided, onCorrect }: QuestionEditorProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors }
  } = useFormContext<QuizFormState>();
  const base = `questions.${index}` as const;
  const question = useWatch({ control, name: base });
  const defaultTime = useWatch({ control, name: 'settings.defaultTimeLimitSec' });
  const fieldErrors = errors.questions?.[index];

  const promptMessage = fieldErrors?.prompt?.message ?? issues.prompt;
  const optionsMessage =
    fieldErrors?.options?.message ?? fieldErrors?.options?.root?.message ?? issues.options ?? issues.correctOptionId;

  // Switching type swaps the option set; the answer survives only if it is still a valid T/F id.
  function changeType(type: QuestionType) {
    if (type === question.type) return;
    const keepsAnswer = type === 'true_false' && ['true', 'false'].includes(question.correctOptionId ?? '');
    setValue(`${base}.type`, type, { shouldDirty: true });
    setValue(`${base}.options`, optionsFor(type), { shouldDirty: true });
    setValue(`${base}.correctOptionId`, keepsAnswer ? question.correctOptionId : null, { shouldDirty: true });
  }

  const [confirming, setConfirming] = useState(false);
  // Only a question with something written needs a second thought.
  const remove = () => (question.prompt.trim() ? setConfirming(true) : onRemove());

  return (
    <div className="flex flex-col gap-4 border-t border-[color:var(--rule)] p-4">
      <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <Segmented
          aria-label="Question type"
          options={TYPE_OPTIONS}
          value={question.type}
          onChange={changeType}
        />
        <TextArea
          label="Question"
          rows={3}
          {...register(`${base}.prompt`)}
          head={<CharCount length={question.prompt.length} max={QUIZ_TEXT_LIMITS.prompt} />}
          status={promptMessage ? 'bad' : undefined}
          message={promptMessage}
        />
        <OptionsEditor
          // Remounts the field array when the option set is swapped wholesale.
          key={question.type}
          index={index}
          type={question.type}
          correctOptionId={question.correctOptionId}
          {...(optionsMessage ? { error: optionsMessage } : {})}
        />
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <Field
            label="Time limit (s)"
            type="number"
            inputMode="numeric"
            min={QUIZ_TIME_LIMIT_SEC.min}
            max={QUIZ_TIME_LIMIT_SEC.max}
            placeholder={String(defaultTime)}
            {...register(`${base}.timeLimitSec`, {
              setValueAs: (v: string | number | null) => (v === '' || v == null ? null : Number(v))
            })}
            status={fieldErrors?.timeLimitSec ? 'bad' : undefined}
            message={fieldErrors?.timeLimitSec ? `Use ${QUIZ_TIME_LIMIT_SEC.min}–${QUIZ_TIME_LIMIT_SEC.max}.` : undefined}
          />
          <div className="grid gap-[0.4rem]">
            <span className="type-label">Difficulty</span>
            <Segmented
              aria-label="Difficulty"
              options={DIFFICULTY_OPTIONS}
              value={question.difficulty}
              onChange={(value: QuestionDifficulty) => setValue(`${base}.difficulty`, value, { shouldDirty: true })}
            />
          </div>
        </div>
        <TextArea
          label="Explanation (optional, shown in review)"
          rows={2}
          {...register(`${base}.explanation`, { setValueAs: (v: string | null) => (v ? v : null) })}
          head={<CharCount length={question.explanation?.length ?? 0} max={QUIZ_TEXT_LIMITS.explanation} />}
          status={fieldErrors?.explanation ? 'bad' : undefined}
          message={fieldErrors?.explanation?.message}
        />
        {!locked && (
          <button
            type="button"
            onClick={remove}
            className="flex min-h-11 items-center gap-2 self-start text-sm text-error hover:text-paper"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Remove question
          </button>
        )}
      </fieldset>
      {locked &&
        (voided ? (
          <p className="m-0 flex items-center gap-2 text-sm text-amber">
            <Ban className="h-4 w-4 shrink-0" aria-hidden /> Voided: not counted in anyone’s score or total.
          </p>
        ) : (
          <Button type="button" variant="quiet" onClick={onCorrect} className="min-h-11 gap-2 self-start px-3">
            <PencilLine className="h-4 w-4" aria-hidden /> Correct answer key
          </Button>
        ))}
      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Remove this question?"
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button type="button" onClick={onRemove}>
              Remove
            </Button>
          </>
        }
      >
        <p className="m-0 text-taupe">It goes when you save the quiz; Discard brings it back.</p>
      </Sheet>
    </div>
  );
}
