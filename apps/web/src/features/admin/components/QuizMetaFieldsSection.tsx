import type { ChangeEvent } from 'react';
import { Field } from '@/components/ui/Field';

interface QuizMetaFieldsSectionProps {
  questionCount: string;
  durationMinutes: string;
  onChangeQuestionCount: (value: string) => void;
  onChangeDurationMinutes: (value: string) => void;
  errors: Record<string, string>;
}

/** `quizQuestionCount` / `quizDurationMinutes` — both nullable, both just for
 * the Home screen's "20 questions, 30 minutes" copy (spec §11). Blank clears
 * to `null`, same convention as prizes and the description. */
export function QuizMetaFieldsSection({
  questionCount,
  durationMinutes,
  onChangeQuestionCount,
  onChangeDurationMinutes,
  errors
}: QuizMetaFieldsSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <p className="type-label">Quiz</p>

      <Field
        label="Question count"
        type="number"
        min={1}
        placeholder="20"
        value={questionCount}
        status={errors.quizQuestionCount ? 'bad' : undefined}
        message={errors.quizQuestionCount}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChangeQuestionCount(event.target.value)}
      />

      <Field
        label="Duration (minutes)"
        type="number"
        min={1}
        placeholder="30"
        value={durationMinutes}
        status={errors.quizDurationMinutes ? 'bad' : undefined}
        message={errors.quizDurationMinutes ?? 'Leave a field blank to leave it undecided.'}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChangeDurationMinutes(event.target.value)}
      />
    </section>
  );
}
