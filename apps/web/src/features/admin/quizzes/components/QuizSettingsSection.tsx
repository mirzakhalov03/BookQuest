import { useFormContext } from 'react-hook-form';
import { QUIZ_TIME_LIMIT_SEC } from '@bookquest/shared';
import { Field } from '@/components/ui/Field';
import type { QuizFormState } from '../quizForm';
import { useT } from '@/i18n';

const TOGGLES = [
  { name: 'settings.shuffleQuestions', key: 'shuffleQuestions' },
  { name: 'settings.shuffleOptions', key: 'shuffleOptions' }
] as const;

export function QuizSettingsSection() {
  const {
    register,
    formState: { errors }
  } = useFormContext<QuizFormState>();
  const t = useT().adminQuiz.editor;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-label m-0">{t.settings}</h2>
      {TOGGLES.map(({ name, key }) => (
        <label key={name} className="flex min-h-11 items-center gap-3 text-paper">
          <input type="checkbox" className="h-5 w-5 accent-[color:var(--color-ember)]" {...register(name)} />
          {t[key]}
        </label>
      ))}
      <Field
        label={t.defaultTime}
        type="number"
        inputMode="numeric"
        min={QUIZ_TIME_LIMIT_SEC.min}
        max={QUIZ_TIME_LIMIT_SEC.max}
        {...register('settings.defaultTimeLimitSec', { valueAsNumber: true })}
        status={errors.settings?.defaultTimeLimitSec ? 'bad' : undefined}
        message={
          errors.settings?.defaultTimeLimitSec
            ? t.secondsRange(QUIZ_TIME_LIMIT_SEC.min, QUIZ_TIME_LIMIT_SEC.max)
            : undefined
        }
      />
    </section>
  );
}
