import { QUEST_DATE_FIELDS, type AdminQuest, type UpdateQuestPayload } from '@bookquest/shared';
import { formatLongDate } from '@/lib/format';
import { DATE_LABEL } from '../dates';
import { toFormState } from './questForm';
import { describeQuizConfig } from './quizConfig';

export interface ChangeLine {
  label: string;
  before: string;
  after: string;
}

const PRIZE_LABEL = { first: 'First prize', second: 'Second prize', third: 'Third prize' } as const;

/** Only edits participants have already planned around get a second look; typos just save. */
export function needsReview(quest: AdminQuest, patch: UpdateQuestPayload): boolean {
  if (quest.phase === 'upcoming') return false;
  return patch.prizes !== undefined || patch.quizConfig !== undefined || QUEST_DATE_FIELDS.some((field) => patch[field] !== undefined);
}

export function describeRiskyChanges(
  quest: AdminQuest,
  patch: UpdateQuestPayload,
  quizTitle: (id: string) => string
): ChangeLine[] {
  const lines: ChangeLine[] = [];

  for (const field of QUEST_DATE_FIELDS) {
    const next = patch[field];
    if (next) lines.push({ label: DATE_LABEL[field], before: formatLongDate(quest[field]), after: formatLongDate(next) });
  }
  for (const place of ['first', 'second', 'third'] as const) {
    const next = patch.prizes?.[place];
    if (next !== undefined) {
      lines.push({ label: PRIZE_LABEL[place], before: quest.prizes[place] ?? 'None', after: next ?? 'None' });
    }
  }
  if (patch.quizConfig !== undefined) {
    lines.push({
      label: 'Quiz setup',
      before: describeQuizConfig(toFormState(quest).quizConfig, quizTitle),
      after: describeQuizConfig(patch.quizConfig, quizTitle)
    });
  }
  return lines;
}
