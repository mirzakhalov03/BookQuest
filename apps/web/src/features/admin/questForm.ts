import type { Book, BookResource, Prizes, Quest, QuestDates, UpdateQuestPayload } from '@bookquest/shared';
import { toDateTimeLocalInput } from '@/lib/format';

export interface ResourceDraft {
  label: string;
  url: string;
  kind: BookResource['kind'];
}

export interface QuestFormState {
  book: {
    title: string;
    author: string;
    pages: string;
    coverUrl: string;
    description: string;
    resources: ResourceDraft[];
  };
  prizes: { first: string; second: string; third: string };
  dates: {
    opensAt: string;
    readingDeadline: string;
    quizOpensAt: string;
    quizClosesAt: string;
    resultsAt: string;
  };
  quizQuestionCount: string;
  quizDurationMinutes: string;
}

/** Everything the API sends becomes an editable string — even `pages`, a
 * number — so every field in the form is the same kind of controlled input,
 * and blank has one obvious meaning (see `trimmedOrNull` below) instead of
 * `NaN` or `0` standing in for "cleared". */
export function toFormState(quest: Quest): QuestFormState {
  return {
    book: {
      title: quest.book.title,
      author: quest.book.author,
      pages: String(quest.book.pages),
      coverUrl: quest.book.coverUrl ?? '',
      description: quest.book.description ?? '',
      resources: quest.book.resources.map((resource) => ({ ...resource }))
    },
    prizes: {
      first: quest.prizes.first ?? '',
      second: quest.prizes.second ?? '',
      third: quest.prizes.third ?? ''
    },
    dates: {
      opensAt: toDateTimeLocalInput(quest.opensAt),
      readingDeadline: toDateTimeLocalInput(quest.readingDeadline),
      quizOpensAt: toDateTimeLocalInput(quest.quizOpensAt),
      quizClosesAt: toDateTimeLocalInput(quest.quizClosesAt),
      resultsAt: toDateTimeLocalInput(quest.resultsAt)
    },
    quizQuestionCount: quest.quizQuestionCount === null ? '' : String(quest.quizQuestionCount),
    quizDurationMinutes: quest.quizDurationMinutes === null ? '' : String(quest.quizDurationMinutes)
  };
}

/**
 * The form's five dates as `Date`s — the shape `findQuestDateIssues` takes.
 * This is form state, not a diff, so it's always the full merged picture:
 * exactly what the server checks ordering against after applying a partial
 * patch (spec: "a partial admin edit only makes sense against the *merged*
 * result").
 */
export function formDates(form: QuestFormState): QuestDates {
  return {
    opensAt: new Date(form.dates.opensAt),
    readingDeadline: new Date(form.dates.readingDeadline),
    quizOpensAt: new Date(form.dates.quizOpensAt),
    quizClosesAt: new Date(form.dates.quizClosesAt),
    resultsAt: new Date(form.dates.resultsAt)
  };
}

/** Blank means "clear it" — the schema's prize and cover/description fields
 * are all nullable, and an empty input is never meant to become `""`. */
function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function emptyResource(): ResourceDraft {
  return { label: '', url: '', kind: 'link' };
}

export function isValidResourceUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Only what changed, nested only as deep as it changed — `book: { title }`
 * alone if only the title moved, never the whole `book` object. The body
 * schema is `strictObject().partial()` at every level it nests one, so a
 * field the admin never touched must never appear in the request: sending it
 * back unchanged is indistinguishable, on the wire, from sending it changed.
 *
 * Returns `null` when nothing differs — the caller uses that to keep Save
 * disabled rather than firing a request the server would 400 for having
 * nothing to update.
 */
export function buildQuestPatch(initial: Quest, form: QuestFormState): UpdateQuestPayload | null {
  const patch: UpdateQuestPayload = {};

  const book: Partial<Book> = {};
  if (form.book.title !== initial.book.title) book.title = form.book.title;
  if (form.book.author !== initial.book.author) book.author = form.book.author;
  const pages = Number(form.book.pages);
  if (Number.isFinite(pages) && pages !== initial.book.pages) book.pages = pages;
  const coverUrl = trimmedOrNull(form.book.coverUrl);
  if (coverUrl !== initial.book.coverUrl) book.coverUrl = coverUrl;
  const description = trimmedOrNull(form.book.description);
  if (description !== initial.book.description) book.description = description;
  const resources: BookResource[] = form.book.resources.map((resource) => ({
    label: resource.label.trim(),
    url: resource.url.trim(),
    kind: resource.kind
  }));
  if (JSON.stringify(resources) !== JSON.stringify(initial.book.resources)) {
    book.resources = resources;
  }
  if (Object.keys(book).length > 0) patch.book = book;

  const prizes: Partial<Prizes> = {};
  const first = trimmedOrNull(form.prizes.first);
  if (first !== initial.prizes.first) prizes.first = first;
  const second = trimmedOrNull(form.prizes.second);
  if (second !== initial.prizes.second) prizes.second = second;
  const third = trimmedOrNull(form.prizes.third);
  if (third !== initial.prizes.third) prizes.third = third;
  if (Object.keys(prizes).length > 0) patch.prizes = prizes;

  const dates = formDates(form);
  const dateFields = ['opensAt', 'readingDeadline', 'quizOpensAt', 'quizClosesAt', 'resultsAt'] as const;
  for (const field of dateFields) {
    if (dates[field].getTime() !== Date.parse(initial[field])) {
      patch[field] = dates[field];
    }
  }

  const quizQuestionCount =
    form.quizQuestionCount.trim() === '' ? null : Number(form.quizQuestionCount);
  if (quizQuestionCount !== initial.quizQuestionCount) patch.quizQuestionCount = quizQuestionCount;

  const quizDurationMinutes =
    form.quizDurationMinutes.trim() === '' ? null : Number(form.quizDurationMinutes);
  if (quizDurationMinutes !== initial.quizDurationMinutes) {
    patch.quizDurationMinutes = quizDurationMinutes;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
