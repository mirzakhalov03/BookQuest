import { useFormContext, useWatch } from 'react-hook-form';
import { QUIZ_TEXT_LIMITS } from '@bookquest/shared';
import { Field } from '@/components/ui/Field';
import { TextArea } from '@/components/ui/TextArea';
import type { QuizFormState } from '../quizForm';
import { CharCount } from './CharCount';

export function QuizDetailsSection() {
  const {
    register,
    control,
    formState: { errors }
  } = useFormContext<QuizFormState>();
  const description = useWatch({ control, name: 'description' });

  return (
    <section className="flex flex-col gap-2">
      <Field
        label="Title"
        maxLength={QUIZ_TEXT_LIMITS.title}
        {...register('title')}
        status={errors.title ? 'bad' : undefined}
        message={errors.title?.message}
      />
      <TextArea
        label="Description (optional)"
        rows={3}
        {...register('description', { setValueAs: (v: string | null) => (v ? v : null) })}
        head={<CharCount length={description?.length ?? 0} max={QUIZ_TEXT_LIMITS.description} />}
        status={errors.description ? 'bad' : undefined}
        message={errors.description?.message}
      />
    </section>
  );
}
