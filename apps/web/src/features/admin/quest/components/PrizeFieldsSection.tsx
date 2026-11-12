import { useFormContext } from 'react-hook-form';
import { Field, statusFor } from '@/components/ui/Field';
import type { QuestFormState } from '../questForm';
import { useT } from '@/i18n';

/** Free text, all nullable; blank clears a prize back to `null`. */
export function PrizeFieldsSection() {
  const {
    register,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const t = useT().adminQuest.prizes;

  return (
    <>
      {/* Its own line: Field hides neutral messages (opacity 0), so a hint there never showed. */}
      <p className="m-0 text-sm text-taupe">{t.blankHint}</p>
      <Field label={t.first} placeholder={t.firstPlaceholder} {...register('prizes.first')} {...statusFor(errors.prizes?.first?.message)} />
      <Field label={t.second} placeholder={t.secondPlaceholder} {...register('prizes.second')} {...statusFor(errors.prizes?.second?.message)} />
      <Field label={t.third} placeholder={t.thirdPlaceholder} {...register('prizes.third')} {...statusFor(errors.prizes?.third?.message)} />
    </>
  );
}
