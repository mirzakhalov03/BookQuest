import { formatShortDate } from '@/lib/format';
import { parseLocal } from '../dates';
import type { EditorSectionId } from './changes';
import type { QuestFormState } from './questForm';

const short = (value: string) => {
  const date = parseLocal(value);
  return date ? formatShortDate(date) : '—';
};

/** One line per collapsed section header, from the current (unsaved) values. */
export function sectionSummaries(values: QuestFormState): Record<EditorSectionId, string> {
  const { book, prizes, dates } = values;
  const count = values.quizQuestionCount.trim();
  const minutes = values.quizDurationMinutes.trim();

  return {
    book: [book.title.trim() || 'Untitled', book.pages.trim() && `${book.pages.trim()} pp`, book.coverUrl ? 'cover' : 'drawn cover']
      .filter(Boolean)
      .join(' · '),
    resources:
      book.resources.length === 0
        ? 'None yet'
        : book.resources.map((resource) => resource.label.trim() || 'Untitled').join(' · '),
    prizes:
      [prizes.first, prizes.second, prizes.third]
        .map((prize) => prize.trim())
        .filter(Boolean)
        .join(' · ') || 'None set',
    dates: `Opens ${short(dates.opensAt)} · Quiz ${short(dates.quizOpensAt)}–${short(dates.quizClosesAt)}`,
    quiz:
      !count && !minutes
        ? 'Undecided'
        : [count && `${count} questions`, minutes && `${minutes} min`].filter(Boolean).join(' · ')
  };
}
