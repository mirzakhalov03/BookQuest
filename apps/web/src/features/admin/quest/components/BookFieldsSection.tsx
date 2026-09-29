import { Controller, useFormContext } from 'react-hook-form';
import { Field, statusFor } from '@/components/ui/Field';
import { TextArea } from '@/components/ui/TextArea';
import type { QuestFormState } from '../questForm';
import { CoverPicker } from './CoverPicker';

interface BookFieldsSectionProps {
  /** Lets the page hold Save while a cover is still uploading. */
  onCoverUploadingChange: (uploading: boolean) => void;
}

/** The cover uploads on pick and lands as a URL, so Save treats it like any other text field. */
export function BookFieldsSection({ onCoverUploadingChange }: BookFieldsSectionProps) {
  const {
    register,
    control,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const e = errors.book;

  return (
    <>
      <Field label="Title" {...register('book.title')} {...statusFor(e?.title?.message)} />
      <Field label="Author" {...register('book.author')} {...statusFor(e?.author?.message)} />
      <Controller
        control={control}
        name="book.coverUrl"
        // Controller writes only this field, so a late upload can't overwrite other edits.
        render={({ field, fieldState }) => (
          <CoverPicker
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            onUploadingChange={onCoverUploadingChange}
            aside={
              <Field
                label="Pages"
                className="max-w-32"
                type="number"
                inputMode="numeric"
                min={1}
                {...register('book.pages')}
                {...statusFor(e?.pages?.message)}
              />
            }
          />
        )}
      />
      <TextArea
        label="Description"
        rows={4}
        placeholder="A shepherd boy leaves everything he knows…"
        {...register('book.description')}
        {...statusFor(e?.description?.message)}
      />
    </>
  );
}
