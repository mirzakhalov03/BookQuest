import type { Quest, QuestPhase } from '@bookquest/shared';
import { getT } from '@/i18n';

export const phaseLabel = (phase: QuestPhase): string => getT().admin.phase[phase];

export interface Milestone {
  label: string;
  at: string;
}

/** The next date the quest is waiting on. `null` once results are out — nothing left to count to. */
export function nextMilestone(quest: Quest, now: Date): Milestone | null {
  const before = (iso: string) => now.getTime() < Date.parse(iso);
  const t = getT().admin.milestone;

  switch (quest.phase) {
    case 'upcoming':
      return { label: t.opens, at: quest.opensAt };
    case 'reading':
      // The phase stays "reading" between the deadline and the quiz opening.
      return before(quest.readingDeadline)
        ? { label: t.readingEnds, at: quest.readingDeadline }
        : { label: t.quizOpens, at: quest.quizOpensAt };
    case 'quiz':
      return { label: t.quizCloses, at: quest.quizClosesAt };
    case 'finished':
      return before(quest.resultsAt) ? { label: t.resultsPublished, at: quest.resultsAt } : null;
  }
}

/** Results, ranks and certificates exist only for the current quest, so it can't be archived before `resultsAt`. */
export function canStartNextEdition(quest: Quest, now: Date): boolean {
  return quest.phase === 'finished' && now.getTime() >= Date.parse(quest.resultsAt);
}
