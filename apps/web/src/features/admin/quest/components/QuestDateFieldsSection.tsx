import { Controller, useFormContext } from 'react-hook-form';
import { QUEST_DATE_FIELDS } from '@bookquest/shared';
import { Field, statusFor } from '@/components/ui/Field';
import { DATE_LABEL } from '../../dates';
import type { QuestFormState } from '../questForm';

const DATE_PATHS = QUEST_DATE_FIELDS.map((key) => `dates.${key}` as const);

export function QuestDateFieldsSection() {
  const { control, trigger } = useFormContext<QuestFormState>();

  return (
    <>
      {QUEST_DATE_FIELDS.map((key) => (
        <Controller
          key={key}
          control={control}
          name={`dates.${key}`}
          render={({ field, fieldState }) => (
            <Field
              ref={field.ref}
              type="datetime-local"
              label={DATE_LABEL[key]}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(event) => {
                field.onChange(event.target.value);
                // Ordering errors can land on a date the user didn't touch, so re-check all five.
                void trigger(DATE_PATHS);
              }}
              {...statusFor(fieldState.error?.message)}
            />
          )}
        />
      ))}
    </>
  );
}
