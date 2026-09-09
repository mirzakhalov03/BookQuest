import type { ChangeEvent } from 'react';
import { Field } from '@/components/ui/Field';
import type { QuestFormState } from '../questForm';

interface PrizeFieldsSectionProps {
  value: QuestFormState['prizes'];
  onChange: (value: QuestFormState['prizes']) => void;
  errors: Record<string, string>;
}

/**
 * Free text, all three nullable (spec, contract). Nothing to validate beyond
 * "did it change" — a prize is whatever an admin types, and a blank input
 * clears it back to `null` rather than saving an empty string.
 */
export function PrizeFieldsSection({ value, onChange, errors }: PrizeFieldsSectionProps) {
  const set = (patch: Partial<QuestFormState['prizes']>) => onChange({ ...value, ...patch });

  return (
    <section className="flex flex-col gap-4">
      <p className="type-label">Prizes</p>

      <Field
        label="First place"
        placeholder="AirPods Pro"
        value={value.first}
        status={errors['prizes.first'] ? 'bad' : undefined}
        message={errors['prizes.first']}
        onChange={(event: ChangeEvent<HTMLInputElement>) => set({ first: event.target.value })}
      />

      <Field
        label="Second place"
        placeholder="1,000,000 so‘m"
        value={value.second}
        status={errors['prizes.second'] ? 'bad' : undefined}
        message={errors['prizes.second']}
        onChange={(event: ChangeEvent<HTMLInputElement>) => set({ second: event.target.value })}
      />

      <Field
        label="Third place"
        placeholder="A year of books, on us"
        value={value.third}
        status={errors['prizes.third'] ? 'bad' : undefined}
        message={errors['prizes.third'] ?? 'Leave a field blank to clear a prize.'}
        onChange={(event: ChangeEvent<HTMLInputElement>) => set({ third: event.target.value })}
      />
    </section>
  );
}
