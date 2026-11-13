import { Controller, useFormContext } from 'react-hook-form';
import { PRIZE_PLACES } from '@bookquest/shared';
import { Field, statusFor } from '@/components/ui/Field';
import type { QuestFormState } from '../questForm';
import { ImagePicker } from './ImagePicker';
import { useT } from '@/i18n';

interface PrizeFieldsSectionProps {
  /** Lets the page hold Save while the photo is still uploading. */
  onPhotoUploadingChange: (uploading: boolean) => void;
}

/** An optional photo of all the prizes, then free text per place; blank clears a prize back to `null`. */
export function PrizeFieldsSection({ onPhotoUploadingChange }: PrizeFieldsSectionProps) {
  const {
    register,
    control,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const t = useT().adminQuest.prizes;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Controller
          control={control}
          name="prizes.photoUrl"
          render={({ field, fieldState }) => (
            <ImagePicker
              shape="wide"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              onUploadingChange={onPhotoUploadingChange}
              labels={{
                title: t.photo,
                alt: t.photoAlt,
                choose: t.addPhoto,
                replace: t.replacePhoto,
                view: t.viewPhoto,
                remove: t.removePhoto
              }}
            />
          )}
        />
        <p className="m-0 text-sm text-taupe">{t.photoHint}</p>
      </div>
      {/* Its own line: Field hides neutral messages (opacity 0), so a hint there never showed. */}
      <p className="m-0 text-sm text-taupe">{t.blankHint}</p>
      {PRIZE_PLACES.map(({ key }) => (
        <Field
          key={key}
          label={t[key]}
          placeholder={t[`${key}Placeholder`]}
          {...register(`prizes.${key}`)}
          {...statusFor(errors.prizes?.[key]?.message)}
        />
      ))}
    </>
  );
}
