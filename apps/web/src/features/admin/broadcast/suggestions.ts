import type { Quest } from '@bookquest/shared';
import { formatLongDate } from '@/lib/format';

export interface Suggestion {
  label: string;
  message: string;
}

const DAY_MS = 86_400_000;

/** Starting points from the quest's own dates, so the facts in a broadcast are never retyped by hand. */
export function broadcastSuggestions(quest: Quest, now: Date): Suggestion[] {
  const { title, author } = quest.book;

  switch (quest.phase) {
    case 'upcoming':
      return [
        {
          label: 'Announce the opening',
          message: `BookQuest ${quest.year} opens on ${formatLongDate(quest.opensAt)}. This year's book is ${title} by ${author}. Open BookQuest to join!`
        }
      ];
    case 'reading': {
      const left = Date.parse(quest.readingDeadline) - now.getTime();
      const quizDates = {
        label: 'Quiz dates',
        message: `Mark your calendar: the quiz opens ${formatLongDate(quest.quizOpensAt)} and closes ${formatLongDate(quest.quizClosesAt)}. One attempt, so pick your moment!`
      };
      // Past the deadline a reading reminder would say "0 days left"; the quiz dates lead instead.
      if (left <= 0) return [quizDates];

      const days = Math.floor(left / DAY_MS);
      const remaining = days < 1 ? 'Less than a day' : `${days} ${days === 1 ? 'day' : 'days'}`;
      return [
        {
          label: 'Remind readers',
          message: `${remaining} left to finish ${title}. The quiz opens ${formatLongDate(quest.quizOpensAt)}.`
        },
        quizDates
      ];
    }
    case 'quiz':
      return [
        {
          label: 'Quiz is open',
          message: `The quiz is open until ${formatLongDate(quest.quizClosesAt)}. One attempt. Good luck!`
        }
      ];
    case 'finished':
      return now.getTime() < Date.parse(quest.resultsAt)
        ? [{ label: 'Results date', message: `The quiz has closed. Results are published ${formatLongDate(quest.resultsAt)}.` }]
        : [{ label: 'Results are out', message: `Results for ${title} are out! Open BookQuest to see where you placed.` }];
  }
}
