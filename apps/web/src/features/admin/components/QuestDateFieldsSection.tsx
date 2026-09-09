import type { ChangeEvent } from 'react';
import { Field } from '@/components/ui/Field';
import type { QuestFormState } from '../questForm';

interface QuestDateFieldsSectionProps {
  value: QuestFormState['dates'];
  onChange: (value: QuestFormState['dates']) => void;
  /** `findQuestDateIssues`'s own return, recomputed live from the current
   * form on every render — this is the client mirror, checked before a
   * request is ever sent. */
  issues: Record<string, string> | null;
  /** Server `error.fields` from the last submit. Only shown when the live
   * check above has nothing to say about that field — the two should never
   * disagree, since both run the same function, but the server's answer is
   * the one that's actually final. */
  errors: Record<string, string>;
}

const DATE_FIELDS: Array<{ key: keyof QuestFormState['dates']; label: string }> = [
  { key: 'opensAt', label: 'Opens' },
  { key: 'readingDeadline', label: 'Reading deadline' },
  { key: 'quizOpensAt', label: 'Quiz opens' },
  { key: 'quizClosesAt', label: 'Quiz closes' },
  { key: 'resultsAt', label: 'Results published' }
];

/**
 * The five dates, `opensAt < readingDeadline <= quizOpensAt < quizClosesAt <=
 * resultsAt`. `datetime-local` inputs, not five separate date/time pairs —
 * see `toDateTimeLocalInput` in `lib/format.ts` for why the value is built
 * from local date parts rather than sliced off the UTC ISO string.
 */
export function QuestDateFieldsSection({ value, onChange, issues, errors }: QuestDateFieldsSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <p className="type-label">Dates</p>

      {DATE_FIELDS.map(({ key, label }) => {
        const message = issues?.[key] ?? errors[key];
        return (
          <Field
            key={key}
            type="datetime-local"
            label={label}
            value={value[key]}
            status={message ? 'bad' : undefined}
            message={message}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...value, [key]: event.target.value })
            }
          />
        );
      })}
    </section>
  );
}
