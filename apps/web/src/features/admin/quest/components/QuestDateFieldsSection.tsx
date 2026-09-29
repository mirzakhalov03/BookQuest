import { Controller, useFormContext } from 'react-hook-form';
import { QUEST_DATE_FIELDS } from '@bookquest/shared';
import { Field, statusFor } from '@/components/ui/Field';
import { DATE_LABEL } from '../../dates';
import type { QuestFormState } from '../questForm';

/** One Controller over the whole `dates` object, so an ordering error lands on whichever date it names. */
export function QuestDateFieldsSection() {
  const { control, trigger } = useFormContext<QuestFormState>();

  return (
    <Controller
      control={control}
      name="dates"
      render={({ field, formState: { errors } }) => (
        <>
          {QUEST_DATE_FIELDS.map((key) => (
            <Field
              key={key}
              type="datetime-local"
              label={DATE_LABEL[key]}
              value={field.value[key]}
              onChange={(event) => {
                field.onChange({ ...field.value, [key]: event.target.value });
                // Re-validate explicitly: the resolver's lookup for a whole-object Controller drops nested errors.
                void trigger('dates');
              }}
              {...statusFor(errors.dates?.[key]?.message)}
            />
          ))}
        </>
      )}
    />
  );
}
