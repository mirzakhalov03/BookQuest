import type { CreateQuestPayload, Prizes, Quest } from '@bookquest/shared';
import { defaultDates, plusOneYear } from '../dates';
import { formDates, toPrizeForm, toPrizes, toResources, trimmedOrNull, type QuestFormState } from './questForm';

export interface EditionDraft {
  edition: number;
  values: QuestFormState;
}

const NO_PRIZES: Prizes = { first: null, second: null, third: null, fourth: null, fifth: null, photoUrl: null };

const EMPTY_BOOK: QuestFormState['book'] = {
  title: '',
  author: '',
  pages: '',
  coverUrl: '',
  description: '',
  resources: []
};

/**
 * Prizes and the schedule carry over (a year later); the book is new every
 * year, so it starts blank, and so does the quiz setup (quizzes are
 * book-specific). A source old enough that "a year later" is still past falls
 * back to a fresh schedule.
 */
export function nextEditionDraft(source: Quest | null, now: Date): EditionDraft {
  if (!source) {
    return {
      edition: 1,
      values: {
        book: EMPTY_BOOK,
        bookRevealed: false,
        prizes: toPrizeForm(NO_PRIZES),
        dates: defaultDates(now),
        quizConfig: null
      }
    };
  }

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
      book: EMPTY_BOOK,
      // Launches are announcements: the new book starts hidden.
      bookRevealed: false,
      // The photo stays behind: it shows last year's prizes, and two quests sharing one upload
      // would let either one's replace delete the other's file.
      prizes: toPrizeForm({ ...source.prizes, photoUrl: null }),
      quizConfig: null,
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
    prizes: toPrizes(values.prizes),
    bookRevealed: values.bookRevealed,
    ...dates,
    makeCurrent: true
  };
}
