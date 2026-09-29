import { useFormContext } from 'react-hook-form';
import { Field } from '@/components/ui/Field';
import type { QuestFormState } from '../questForm';

/** Only for the Home screen's "20 questions, 30 minutes" line; blank means undecided. */
export function QuizMetaFieldsSection() {
  const {
    register,
    formState: { errors }
  } = useFormContext<QuestFormState>();

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field
        label="Questions"
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="20"
        {...register('quizQuestionCount')}
        status={errors.quizQuestionCount ? 'bad' : undefined}
        message={errors.quizQuestionCount?.message}
      />
      <Field
        label="Minutes"
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="30"
        {...register('quizDurationMinutes')}
        status={errors.quizDurationMinutes ? 'bad' : undefined}
        message={errors.quizDurationMinutes?.message}
      />
    </div>
  );
}
