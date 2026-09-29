import type { CreateQuestPayload, Quest } from '@bookquest/shared';
import { defaultDates, plusOneYear } from '../dates';
import { formDates, toFormState, toOptionalCount, toResources, trimmedOrNull, type QuestFormState } from './questForm';

export interface EditionDraft {
  edition: number;
  values: QuestFormState;
}

const EMPTY_BOOK: QuestFormState['book'] = {
  title: '',
  author: '',
  pages: '',
  coverUrl: '',
  description: '',
  resources: []
};

/**
 * Prizes, quiz settings and the schedule carry over (a year later); the book
 * is new every year, so it starts blank. A source old enough that "a year
 * later" is still past falls back to a fresh schedule.
 */
export function nextEditionDraft(source: Quest | null, now: Date): EditionDraft {
  if (!source) {
    return {
      edition: 1,
      values: {
        book: EMPTY_BOOK,
        prizes: { first: '', second: '', third: '' },
        dates: defaultDates(now),
        quizQuestionCount: '',
        quizDurationMinutes: ''
      }
    };
  }

  const carried = toFormState(source);
  const shifted = {
    opensAt: plusOneYear(source.opensAt),
    readingDeadline: plusOneYear(source.readingDeadline),
    quizOpensAt: plusOneYear(source.quizOpensAt),
    quizClosesAt: plusOneYear(source.quizClosesAt),
    resultsAt: plusOneYear(source.resultsAt)
  };

  return {
    edition: source.edition + 1,
    values: {
      ...carried,
      book: EMPTY_BOOK,
      dates: new Date(shifted.opensAt) > now ? shifted : defaultDates(now)
    }
  };
}

/** Year follows the opening date, so a quest opening in January is filed under that year. */
export function buildCreatePayload(edition: number, values: QuestFormState): CreateQuestPayload {
  const dates = formDates(values);

  return {
    edition,
    year: dates.opensAt.getFullYear(),
    book: {
      title: values.book.title.trim(),
      author: values.book.author.trim(),
      pages: Number(values.book.pages),
      coverUrl: trimmedOrNull(values.book.coverUrl),
      description: trimmedOrNull(values.book.description),
      resources: toResources(values.book.resources)
    },
    prizes: {
      first: trimmedOrNull(values.prizes.first),
      second: trimmedOrNull(values.prizes.second),
      third: trimmedOrNull(values.prizes.third)
    },
    ...dates,
    quizQuestionCount: toOptionalCount(values.quizQuestionCount),
    quizDurationMinutes: toOptionalCount(values.quizDurationMinutes),
    makeCurrent: true
  };
}
