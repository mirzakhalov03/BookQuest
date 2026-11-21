import { Controller, useFormContext } from 'react-hook-form';
import { Field, statusFor } from '@/components/ui/Field';
import { TextArea } from '@/components/ui/TextArea';
import { Toggle } from '@/components/ui/Toggle';
import type { QuestFormState } from '../questForm';
import { ImagePicker } from './ImagePicker';
import { SHOWN_CARDS } from '@/features/book/components/cardConfig';
import { useT } from '@/i18n';

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
  const all = useT();
  const t = all.adminQuest.book;
  const bookCards = all.book.cards;

  return (
    <>
      <Controller
        control={control}
        name="bookRevealed"
        render={({ field }) => (
          <Toggle checked={field.value} onChange={field.onChange} label={t.revealLabel} hint={t.revealHint} />
        )}
      />
      <Field label={t.title} placeholder={t.titlePlaceholder} {...register('book.title')} {...statusFor(e?.title?.message)} />
      <Field label={t.author} placeholder={t.authorPlaceholder} {...register('book.author')} {...statusFor(e?.author?.message)} />
      <Controller
        control={control}
        name="book.coverUrl"
        // Controller writes only this field, so a late upload can't overwrite other edits.
        render={({ field, fieldState }) => (
          <ImagePicker
            value={field.value}
            labels={{
              title: t.cover,
              alt: t.coverAlt,
              choose: t.chooseCover,
              replace: t.replaceCover,
              view: t.viewCover,
              remove: t.removeCover
            }}
            onChange={field.onChange}
            error={fieldState.error?.message}
            onUploadingChange={onCoverUploadingChange}
            aside={
              <Field
                label={t.pages}
                placeholder={t.pagesPlaceholder}
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
        label={t.description}
        rows={4}
        placeholder={t.descriptionPlaceholder}
        {...register('book.description')}
        {...statusFor(e?.description?.message)}
      />

      {/* Each card on the Book page shows these steps; left blank, readers get the defaults shown as the placeholder. */}
      <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="type-label mb-1">{t.cardSteps}</legend>
        <p className="m-0 -mt-2 text-sm text-taupe">{t.cardStepsHint}</p>
        {SHOWN_CARDS.map((card) => (
          <TextArea
            key={card}
            label={bookCards[card].title}
            rows={3}
            placeholder={bookCards[card].steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
            {...register(`book.guides.${card}`)}
            {...statusFor(e?.guides?.[card]?.message)}
          />
        ))}
      </fieldset>
    </>
  );
}
