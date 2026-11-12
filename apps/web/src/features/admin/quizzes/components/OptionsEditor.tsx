import { useFieldArray, useFormContext } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { QUIZ_MCQ_OPTIONS, QUIZ_TEXT_LIMITS } from '@bookquest/shared';
import { Field } from '@/components/ui/Field';
import { newOption, type QuizFormState } from '../quizForm';
import { useT } from '@/i18n';

const ICON_BUTTON =
  'flex h-11 w-9 shrink-0 items-center justify-center text-taupe hover:text-paper disabled:opacity-30 disabled:hover:text-taupe';

interface OptionsEditorProps {
  index: number;
  type: 'mcq' | 'true_false';
  correctOptionId: string | null;
  error?: string;
}

/** MCQ: editable text, 2–6 options, reorder. T/F: the fixed pair, only the answer is picked. */
export function OptionsEditor({ index, type, correctOptionId, error }: OptionsEditorProps) {
  const { control, register, setValue } = useFormContext<QuizFormState>();
  const t = useT().adminQuiz.editor;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: `questions.${index}.options`,
    keyName: 'key'
  });
  const isMcq = type === 'mcq';
  const answerPath = `questions.${index}.correctOptionId` as const;

  const pick = (id: string) => setValue(answerPath, id, { shouldDirty: true, shouldValidate: true });

  function removeOption(position: number, id: string) {
    if (id === correctOptionId) setValue(answerPath, null, { shouldDirty: true });
    remove(position);
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className="type-label mb-1 p-0">{t.optionsLegend}</legend>
      {fields.map((option, position) => (
        <div key={option.key} className="flex items-start gap-1">
          <input
            type="radio"
            name={`correct-${index}`}
            checked={correctOptionId === option.id}
            onChange={() => pick(option.id)}
            aria-label={t.markCorrect(position + 1)}
            className="mt-3 h-5 w-5 shrink-0 accent-[color:var(--color-ember)]"
          />
          {isMcq ? (
            <>
              <Field
                label={t.option(position + 1)}
                hideLabel
                placeholder={t.option(position + 1)}
                maxLength={QUIZ_TEXT_LIMITS.option}
                className="min-w-0 flex-1"
                {...register(`questions.${index}.options.${position}.text`)}
              />
              <button
                type="button"
                aria-label={t.moveOptionUp(position + 1)}
                disabled={position === 0}
                onClick={() => move(position, position - 1)}
                className={ICON_BUTTON}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t.moveOptionDown(position + 1)}
                disabled={position === fields.length - 1}
                onClick={() => move(position, position + 1)}
                className={ICON_BUTTON}
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t.removeOption(position + 1)}
                disabled={fields.length <= QUIZ_MCQ_OPTIONS.min}
                onClick={() => removeOption(position, option.id)}
                className={ICON_BUTTON}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : (
            <span className="flex min-h-11 items-center text-paper">{option.id === 'true' ? t.trueText : t.falseText}</span>
          )}
        </div>
      ))}
      {isMcq && fields.length < QUIZ_MCQ_OPTIONS.max && (
        <button
          type="button"
          onClick={() => append(newOption())}
          className="flex min-h-11 items-center gap-2 self-start text-sm text-amber hover:text-paper"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add option
        </button>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
