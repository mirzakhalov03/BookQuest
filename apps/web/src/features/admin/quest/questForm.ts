import { PRIZE_PLACES, QUEST_DATE_FIELDS, type PrizePlaceKey } from '@bookquest/shared';
import type { AdminQuest, Book, BookResource, Prizes, QuestDates, UpdateQuestPayload } from '@bookquest/shared';
import { toDateTimeLocalInput } from '@/lib/format';
import { quizConfigChanged, type QuizConfigForm } from './quizConfig';

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
  /** Off keeps the book a secret from readers. */
  bookRevealed: boolean;
  prizes: Record<PrizePlaceKey, string> & { photoUrl: string };
  dates: {
    opensAt: string;
    readingDeadline: string;
    quizOpensAt: string;
    quizClosesAt: string;
    resultsAt: string;
  };
  quizConfig: QuizConfigForm | null;
}

/** Paths of all five dates, for re-validating them together. */
export const DATE_PATHS = QUEST_DATE_FIELDS.map((key) => `dates.${key}` as const);

/** Everything the API sends becomes an editable string — even `pages`, a
 * number — so every field in the form is the same kind of controlled input,
 * and blank has one obvious meaning (see `trimmedOrNull` below) instead of
 * `NaN` or `0` standing in for "cleared". */
export function toFormState(quest: AdminQuest): QuestFormState {
  const config = quest.quizConfig;
  return {
    book: {
      title: quest.book.title,
      author: quest.book.author,
      pages: String(quest.book.pages),
      coverUrl: quest.book.coverUrl ?? '',
      description: quest.book.description ?? '',
      resources: quest.book.resources.map((resource) => ({ ...resource }))
    },
    bookRevealed: quest.bookRevealed,
    prizes: toPrizeForm(quest.prizes),
    dates: {
      opensAt: toDateTimeLocalInput(quest.opensAt),
      readingDeadline: toDateTimeLocalInput(quest.readingDeadline),
      quizOpensAt: toDateTimeLocalInput(quest.quizOpensAt),
      quizClosesAt: toDateTimeLocalInput(quest.quizClosesAt),
      resultsAt: toDateTimeLocalInput(quest.resultsAt)
    },
    quizConfig: config && { distribution: config.distribution, quizIds: [...config.quizIds] }
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

const PRIZE_FIELD_KEYS = [...PRIZE_PLACES.map((place) => place.key), 'photoUrl'] as const;

/** Every place plus the photo, as editable strings. */
export function toPrizeForm(prizes: Prizes): QuestFormState['prizes'] {
  return Object.fromEntries(PRIZE_FIELD_KEYS.map((key) => [key, prizes[key] ?? ''])) as QuestFormState['prizes'];
}

/** The form's prizes in the API's shape: blank becomes `null`. Shared by the edit diff and the create payload. */
export function toPrizes(form: QuestFormState['prizes']): Prizes {
  return Object.fromEntries(PRIZE_FIELD_KEYS.map((key) => [key, trimmedOrNull(form[key])])) as Prizes;
}

/** Blank means "clear it" — the schema's prize and cover/description fields
 * are all nullable, and an empty input is never meant to become `""`. */
export function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Trimmed rows, the exact shape the API stores — used by both the edit diff and the create payload. */
export function toResources(drafts: ResourceDraft[]): BookResource[] {
  return drafts.map((resource) => ({
    label: resource.label.trim(),
    url: resource.url.trim(),
    kind: resource.kind
  }));
}

export function isValidResourceUrl(value: string): boolean {
  try {
    // Only web links: participants tap these, so javascript: or data: must never pass.
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
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
 * `quizConfig` is the one key the server rejects outright once participants
 * have started, even unchanged, so it is sent only when it really moved.
 *
 * Returns `null` when nothing differs — the caller uses that to keep Save
 * disabled rather than firing a request the server would 400 for having
 * nothing to update.
 */
export function buildQuestPatch(initial: AdminQuest, form: QuestFormState): UpdateQuestPayload | null {
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
  const resources = toResources(form.book.resources);
  if (JSON.stringify(resources) !== JSON.stringify(initial.book.resources)) {
    book.resources = resources;
  }
  if (Object.keys(book).length > 0) patch.book = book;
  if (form.bookRevealed !== initial.bookRevealed) patch.bookRevealed = form.bookRevealed;

  const prizes: Partial<Prizes> = {};
  const formPrizes = toPrizes(form.prizes);
  for (const key of PRIZE_FIELD_KEYS) {
    if (formPrizes[key] !== initial.prizes[key]) prizes[key] = formPrizes[key];
  }
  if (Object.keys(prizes).length > 0) patch.prizes = prizes;

  const dates = formDates(form);
  const dateFields = ['opensAt', 'readingDeadline', 'quizOpensAt', 'quizClosesAt', 'resultsAt'] as const;
  for (const field of dateFields) {
    if (dates[field].getTime() !== Date.parse(initial[field])) {
      patch[field] = dates[field];
    }
  }

  const savedConfig = toFormState(initial).quizConfig;
  if (quizConfigChanged(savedConfig, form.quizConfig)) {
    patch.quizConfig = form.quizConfig && { distribution: form.quizConfig.distribution, quizIds: form.quizConfig.quizIds };
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
