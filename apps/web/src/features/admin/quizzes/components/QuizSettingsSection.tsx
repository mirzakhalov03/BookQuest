import { useFormContext } from 'react-hook-form';
import { QUIZ_TIME_LIMIT_SEC } from '@bookquest/shared';
import { Field } from '@/components/ui/Field';
import type { QuizFormState } from '../quizForm';

const TOGGLES = [
  { name: 'settings.shuffleQuestions', label: 'Shuffle questions' },
  { name: 'settings.shuffleOptions', label: 'Shuffle answer options' }
] as const;

export function QuizSettingsSection() {
  const {
    register,
    formState: { errors }
  } = useFormContext<QuizFormState>();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-label m-0">Settings</h2>
      {TOGGLES.map(({ name, label }) => (
        <label key={name} className="flex min-h-11 items-center gap-3 text-paper">
          <input type="checkbox" className="h-5 w-5 accent-[color:var(--color-ember)]" {...register(name)} />
          {label}
        </label>
      ))}
      <Field
        label="Default time per question (seconds)"
        type="number"
        inputMode="numeric"
        min={QUIZ_TIME_LIMIT_SEC.min}
        max={QUIZ_TIME_LIMIT_SEC.max}
        {...register('settings.defaultTimeLimitSec', { valueAsNumber: true })}
        status={errors.settings?.defaultTimeLimitSec ? 'bad' : undefined}
        message={
          errors.settings?.defaultTimeLimitSec
            ? `Use ${QUIZ_TIME_LIMIT_SEC.min}–${QUIZ_TIME_LIMIT_SEC.max} seconds.`
            : undefined
        }
      />
    </section>
  );
}
