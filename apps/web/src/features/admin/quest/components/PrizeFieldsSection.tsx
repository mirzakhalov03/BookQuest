import { useFormContext } from 'react-hook-form';
import { Field, statusFor } from '@/components/ui/Field';
import type { QuestFormState } from '../questForm';

/** Free text, all nullable; blank clears a prize back to `null`. */
export function PrizeFieldsSection() {
  const {
    register,
    formState: { errors }
  } = useFormContext<QuestFormState>();

  return (
    <>
      {/* Its own line: Field hides neutral messages (opacity 0), so a hint there never showed. */}
      <p className="m-0 text-sm text-taupe">Leave a place blank to clear its prize.</p>
      <Field label="First place" placeholder="AirPods Pro" {...register('prizes.first')} {...statusFor(errors.prizes?.first?.message)} />
      <Field label="Second place" placeholder="1,000,000 so‘m" {...register('prizes.second')} {...statusFor(errors.prizes?.second?.message)} />
      <Field label="Third place" placeholder="A year of books, on us" {...register('prizes.third')} {...statusFor(errors.prizes?.third?.message)} />
    </>
  );
}
