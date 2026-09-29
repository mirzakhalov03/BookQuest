import type { Quest, QuestPhase } from '@bookquest/shared';

export const PHASE_LABEL: Record<QuestPhase, string> = {
  upcoming: 'Upcoming',
  reading: 'Reading',
  quiz: 'Quiz open',
  finished: 'Finished'
};

export interface Milestone {
  label: string;
  at: string;
}

/** The next date the quest is waiting on. `null` once results are out — nothing left to count to. */
export function nextMilestone(quest: Quest, now: Date): Milestone | null {
  const before = (iso: string) => now.getTime() < Date.parse(iso);

  switch (quest.phase) {
    case 'upcoming':
      return { label: 'Opens', at: quest.opensAt };
    case 'reading':
      // The phase stays "reading" between the deadline and the quiz opening.
      return before(quest.readingDeadline)
        ? { label: 'Reading ends', at: quest.readingDeadline }
        : { label: 'Quiz opens', at: quest.quizOpensAt };
    case 'quiz':
      return { label: 'Quiz closes', at: quest.quizClosesAt };
    case 'finished':
      return before(quest.resultsAt) ? { label: 'Results published', at: quest.resultsAt } : null;
  }
}

/** Results, ranks and certificates exist only for the current quest, so it can't be archived before `resultsAt`. */
export function canStartNextEdition(quest: Quest, now: Date): boolean {
  return quest.phase === 'finished' && now.getTime() >= Date.parse(quest.resultsAt);
}
