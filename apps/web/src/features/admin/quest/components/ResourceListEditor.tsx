import { useFieldArray, useFormContext } from 'react-hook-form';
import { Field, statusFor } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { emptyResource, type QuestFormState } from '../questForm';

const RESOURCE_LIMIT = 12;

export function ResourceListEditor() {
  const {
    control,
    register,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const { fields, append, remove } = useFieldArray({ control, name: 'book.resources' });

  return (
    <>
      <ul className="flex flex-col gap-4">
        {fields.map((field, index) => {
          const rowErrors = errors.book?.resources?.[index];
          return (
            <li key={field.id} className="grid gap-3 border-b border-[color:var(--rule)] pb-4 sm:grid-cols-[1fr_2fr_auto]">
              <Field label="Label" {...register(`book.resources.${index}.label`)} {...statusFor(rowErrors?.label?.message)} />
              <Field label="URL" type="url" {...register(`book.resources.${index}.url`)} {...statusFor(rowErrors?.url?.message)} />
              <Button type="button" variant="quiet" onClick={() => remove(index)} className="min-h-11 self-end px-2">
                Remove
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="quiet"
        onClick={() => append(emptyResource())}
        disabled={fields.length >= RESOURCE_LIMIT}
        className="self-start px-2"
      >
        Add resource
      </Button>
    </>
  );
}
