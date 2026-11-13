import { PRIZE_PLACES, QUEST_DATE_FIELDS, type AdminQuest, type UpdateQuestPayload } from '@bookquest/shared';
import { formatLongDate } from '@/lib/format';
import { toFormState } from './questForm';
import { describeQuizConfig } from './quizConfig';
import { getT } from '@/i18n';

export interface ChangeLine {
  label: string;
  before: string;
  after: string;
}

/** Only edits participants have already planned around get a second look; typos just save. */
export function needsReview(quest: AdminQuest, patch: UpdateQuestPayload): boolean {
  // Quiz setup is always reviewed, even before launch (§5.3). So is the reveal: it's the launch moment.
  if (patch.quizConfig !== undefined || patch.bookRevealed !== undefined) return true;
  if (quest.phase === 'upcoming') return false;
  return patch.prizes !== undefined || QUEST_DATE_FIELDS.some((field) => patch[field] !== undefined);
}

export function describeRiskyChanges(
  quest: AdminQuest,
  patch: UpdateQuestPayload,
  quizTitle: (id: string) => string
): ChangeLine[] {
  const lines: ChangeLine[] = [];
  const { admin, adminQuest } = getT();
  const t = adminQuest.review;

  if (patch.bookRevealed !== undefined) {
    lines.push({
      label: t.bookVisibility,
      before: patch.bookRevealed ? t.bookHidden : t.bookShown,
      after: patch.bookRevealed ? t.revealedBook : t.hidBook
    });
  }
  for (const field of QUEST_DATE_FIELDS) {
    const next = patch[field];
    if (next) lines.push({ label: admin.dates[field], before: formatLongDate(quest[field]), after: formatLongDate(next) });
  }
  for (const { key } of PRIZE_PLACES) {
    const next = patch.prizes?.[key];
    if (next !== undefined) {
      lines.push({ label: t.prizes[key], before: quest.prizes[key] ?? t.none, after: next ?? t.none });
    }
  }
  if (patch.prizes?.photoUrl !== undefined) {
    lines.push({
      label: t.prizePhoto,
      before: quest.prizes.photoUrl ? t.photoSet : t.none,
      after: patch.prizes.photoUrl ? (quest.prizes.photoUrl ? t.photoReplaced : t.photoSet) : t.none
    });
  }
  if (patch.quizConfig !== undefined) {
    lines.push({
      label: t.quizSetup,
      before: describeQuizConfig(toFormState(quest).quizConfig, quizTitle),
      after: describeQuizConfig(patch.quizConfig, quizTitle)
    });
  }
  return lines;
}
