import { useMemo } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import type { Quest } from '@bookquest/shared';
import { summarizeChanges, type ChangeSummary } from './changes';
import { buildQuestPatch, type QuestFormState } from './questForm';

const tally = (quest: Quest, values: QuestFormState): ChangeSummary =>
  summarizeChanges(buildQuestPatch(quest, values));
const keyOf = ({ count, sections }: ChangeSummary): string => `${count}:${[...sections].sort().join()}`;

/**
 * The editor's change summary, re-rendering its caller only when the summary
 * changes, not on every keystroke. `compute` is just the trigger; the value is
 * read fresh from the current `quest`, so a save that resets the form is never stale.
 */
export function useQuestChanges(quest: Quest, form: UseFormReturn<QuestFormState>): ChangeSummary {
  useWatch({ control: form.control, compute: (values: QuestFormState) => keyOf(tally(quest, values)) });
  const summary = tally(quest, form.getValues());
  const key = keyOf(summary);
  // Same content, same object: lets memoised children skip the render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => summary, [key]);
}
