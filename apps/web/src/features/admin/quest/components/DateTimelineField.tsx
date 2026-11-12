import { useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { QUEST_DATE_FIELDS, type QuestDateField } from '@bookquest/shared';
import { Field, statusFor } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { formatLongDate } from '@/lib/format';
import { parseLocal, shiftLaterDates, type DateInputs } from '../../dates';
import { QuestTimeline } from '../../components/QuestTimeline';
import { DATE_PATHS, type QuestFormState } from '../questForm';
import { useT } from '@/i18n';

type ShiftMode = 'keep' | 'single';

interface DateTimelineFieldProps {
  /** Saved schedule: a date already past in it is locked. `null` when creating — nothing is past. */
  savedDates: DateInputs | null;
}

export function DateTimelineField({ savedDates }: DateTimelineFieldProps) {
  const {
    control,
    setValue,
    trigger,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const { admin, adminQuest } = useT();
  const t = adminQuest.dates;
  const dates = useWatch({ control, name: 'dates' });
  const [mode, setMode] = useState<ShiftMode>('keep');
  const [unlocked, setUnlocked] = useState<ReadonlySet<QuestDateField>>(new Set());
  // Captured once per editing session on purpose, so dates don't flip to "passed" mid-edit.
  const [now] = useState(() => new Date());

  const isLocked = (field: QuestDateField) => {
    const saved = savedDates ? parseLocal(savedDates[field]) : null;
    return saved !== null && saved <= now && !unlocked.has(field);
  };

  // Ordering errors land on the later date of a pair and keep-the-gaps moves later dates, so both must become inputs.
  const unlockFrom = (key: QuestDateField) =>
    setUnlocked((prev) => new Set([...prev, ...QUEST_DATE_FIELDS.slice(QUEST_DATE_FIELDS.indexOf(key))]));

  // setValue rather than field.onChange: keeping the gaps changes several dates at once.
  const change = (key: QuestDateField, value: string) => {
    const next = mode === 'keep' ? shiftLaterDates(dates, key, value) : { ...dates, [key]: value };
    for (const k of QUEST_DATE_FIELDS) {
      if (next[k] !== dates[k]) setValue(`dates.${k}`, next[k], { shouldDirty: true });
    }
    // Ordering errors can land on a date the user didn't touch, so re-check all five.
    void trigger(DATE_PATHS);
  };

  const parsed = Object.fromEntries(QUEST_DATE_FIELDS.map((key) => [key, parseLocal(dates[key])])) as Record<
    QuestDateField,
    Date | null
  >;

  return (
    <>
      <Switch
        aria-label={t.modeAria}
        options={[
          { value: 'keep', label: t.keepGaps },
          { value: 'single', label: t.moveOne }
        ]}
        value={mode}
        onChange={setMode}
      />
      <QuestTimeline
        dates={parsed}
        now={now}
        renderValue={(key) => {
          const date = parsed[key];
          if (isLocked(key) && date) {
            return (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-paper-dim">{t.passed(formatLongDate(date))}</span>
                  <Button type="button" variant="quiet" className="min-h-11 shrink-0 whitespace-nowrap px-2 text-sm" onClick={() => unlockFrom(key)}>
                    {t.editAnyway}
                  </Button>
                </div>
                {/* Backstop for server errors; ordering errors can't land here because later dates unlock too. */}
                {errors.dates?.[key]?.message && (
                  <p role="alert" className="m-0 text-sm text-error">
                    {errors.dates[key]?.message}
                  </p>
                )}
              </>
            );
          }
          return (
            <Controller
              control={control}
              name={`dates.${key}`}
              render={({ field, fieldState }) => (
                <Field
                  ref={field.ref}
                  type="datetime-local"
                  label={admin.dates[key]}
                  hideLabel
                  // "18 Nov 2026 at 09:00" needs ~14rem; full width just stretches the box.
                  className="w-full max-w-[15rem]"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => change(key, event.target.value)}
                  {...statusFor(fieldState.error?.message)}
                />
              )}
            />
          );
        }}
      />
    </>
  );
}
