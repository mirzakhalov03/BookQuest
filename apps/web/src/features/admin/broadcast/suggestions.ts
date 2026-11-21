import type { AdminQuest } from '@bookquest/shared';
import { formatLongDate } from '@/lib/format';
import { getT } from '@/i18n';

export interface Suggestion {
  label: string;
  message: string;
}

const DAY_MS = 86_400_000;

/** Starting points from the quest's own dates, so the facts in a broadcast are never retyped by hand. */
export function broadcastSuggestions(quest: AdminQuest, now: Date): Suggestion[] {
  const { title } = quest.book;
  const t = getT().admin.broadcast.suggestions;

  switch (quest.phase) {
    case 'upcoming':
      // Nothing canned before opening: the launch is announced by hand.
      return [];
    case 'reading': {
      const left = Date.parse(quest.readingDeadline) - now.getTime();
      const quizDates = {
        label: t.quizDates,
        message: t.quizDatesText(formatLongDate(quest.quizOpensAt), formatLongDate(quest.quizClosesAt))
      };
      // Past the deadline a reading reminder would say "0 days left"; the quiz dates lead instead.
      if (left <= 0) return [quizDates];

      const days = Math.floor(left / DAY_MS);
      return [
        {
          label: t.remind,
          message: t.remindText(days, title, formatLongDate(quest.quizOpensAt))
        },
        quizDates
      ];
    }
    case 'quiz':
      return [
        {
          label: t.quizOpen,
          message: t.quizOpenText(formatLongDate(quest.quizClosesAt))
        }
      ];
    case 'finished':
      return now.getTime() < Date.parse(quest.resultsAt)
        ? [{ label: t.resultsDate, message: t.resultsDateText(formatLongDate(quest.resultsAt)) }]
        : [{ label: t.resultsOut, message: t.resultsOutText(title) }];
  }
}
