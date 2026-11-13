import type {
  AdminQuest,
  Book,
  Prizes,
  CreateQuestPayload,
  CursorPage,
  Quest,
  QuestPhase,
  QuestSummary,
  UpdateQuestPayload
} from '@bookquest/shared';
import { QUEST_DATE_FIELDS, findQuestDateIssues } from '@bookquest/shared';
import { QuestModel, type QuestDocument, type QuestRow } from '../models/quest.model.js';
import { ResultModel } from '../models/result.model.js';
import { ApiError } from '../utils/api-error.js';
import { isDuplicateKeyError } from '../utils/mongo.js';
import { withTransaction } from '../utils/transaction.js';
import { coverIdFromUrl, discardCover, toPublicCoverUrl, toStoredCoverUrl } from './cover.services.js';
import { participantsById } from './participant-lookup.services.js';
import { buildQuizConfig, questHasAttempts } from './quiz-config.services.js';
import { groupLabels } from '../utils/quiz-group.js';

const ARCHIVE_PAGE_SIZE = 20;

export async function getCurrentQuest(): Promise<Quest> {
  return toQuestDto(await requireCurrentQuestDocument());
}

/** Null rather than a throw, for callers where "between editions" is normal. */
export async function findCurrentQuestDocument(): Promise<QuestDocument | null> {
  return QuestModel.findOne({ isCurrent: true });
}

export async function getAdminCurrentQuest(): Promise<AdminQuest> {
  return toAdminQuestDto(await requireCurrentQuestDocument());
}

export async function requireCurrentQuestDocument(): Promise<QuestDocument> {
  const quest = await findCurrentQuestDocument();
  if (!quest) throw ApiError.notFound('No quest is running right now.', { reason: 'quest_not_found' });
  return quest;
}

export async function getQuestByEdition(edition: number): Promise<Quest> {
  const quest = await QuestModel.findOne({ edition });
  if (!quest) throw ApiError.notFound(`There was no edition ${edition}.`, { reason: 'edition_not_found' });
  return toQuestDto(quest);
}

/**
 * The archive. Keyed on `edition`, which is unique and monotonic, so the cursor
 * is stable even if a quest is edited between pages — an offset would shift.
 */
export async function listPastQuests(options: {
  limit?: number;
  cursor?: string | undefined;
}): Promise<CursorPage<QuestSummary>> {
  const limit = Math.min(options.limit ?? ARCHIVE_PAGE_SIZE, 50);
  const before = decodeCursor(options.cursor);

  const quests = await QuestModel.find({
    isCurrent: false,
    // A hidden book must never surface through the archive, even by accident.
    bookRevealed: { $ne: false },
    ...(before === null ? {} : { edition: { $lt: before } })
  })
    .sort({ edition: -1 })
    .limit(limit + 1)
    .lean<QuestRow[]>();

  const page = quests.slice(0, limit);
  const last = page.at(-1);
  const winners = await findWinners(page.map((quest) => String(quest._id)));

  return {
    items: page.map((quest) => toQuestSummary(quest, winners.get(String(quest._id)) ?? null)),
    nextCursor: quests.length > limit && last ? encodeCursor(last.edition) : null
  };
}

/* ── Admin mutations ─────────────────────────────────────────────────────
   Quest content is quest logic, so it lives here; the admin layer is only
   authorization and HTTP shape. */

export async function createQuest(payload: CreateQuestPayload): Promise<AdminQuest> {
  const { makeCurrent, ...fields } = payload;

  const issues = findQuestDateIssues(
    {
      opensAt: fields.opensAt,
      readingDeadline: fields.readingDeadline,
      quizOpensAt: fields.quizOpensAt,
      quizClosesAt: fields.quizClosesAt,
      resultsAt: fields.resultsAt
    },
    { requireResultsBuffer: true }
  );
  if (issues) throw badDates(issues);

  if (makeCurrent) {
    // Results, ranks and certificates are served only for the current quest; archiving it early loses them.
    const outgoing = await findCurrentQuestDocument();
    if (outgoing && new Date() < outgoing.resultsAt) {
      throw ApiError.conflict(`Results for edition ${outgoing.edition} are not out yet.`, { reason: 'results_pending' });
    }
  }

  try {
    // Inserted inside the callback: a retried transaction must insert afresh, not reuse a rolled-back document.
    const quest = await withTransaction(async (session) => {
      const book = { ...fields.book, coverUrl: toStoredCoverUrl(fields.book.coverUrl) };
      const prizes = fields.prizes && { ...fields.prizes, photoUrl: toStoredCoverUrl(fields.prizes.photoUrl) };
      const [created] = await QuestModel.create([{ ...fields, book, prizes, isCurrent: false }], { session });
      if (!created) throw new Error('Quest insert returned no document.');

      if (makeCurrent) {
        // Unset first: the partial unique index allows one current quest at any instant.
        await QuestModel.updateMany({ isCurrent: true }, { $set: { isCurrent: false } }, { session });
        await QuestModel.updateOne({ _id: created._id }, { $set: { isCurrent: true } }, { session });
        created.isCurrent = true;
      }
      return created;
    });
    // Admin-facing: the new edition usually starts hidden, and the admin still needs its book.
    return toAdminQuestDto(quest);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw ApiError.conflict(`Edition ${fields.edition} already exists.`, { reason: 'edition_exists' });
    }
    throw error;
  }
}

export async function updateQuest(questId: string, payload: UpdateQuestPayload): Promise<AdminQuest> {
  const quest = await QuestModel.findById(questId);
  if (!quest) throw ApiError.notFound('No such quest.');

  if (await questHasAttempts(quest._id)) assertLockedChangesAllowed(quest, payload);

  /* Ordering is checked against the merged result, not the payload: a partial
     edit is only valid in the context of the dates it does not touch. */
  const issues = findQuestDateIssues(
    {
      opensAt: payload.opensAt ?? quest.opensAt,
      readingDeadline: payload.readingDeadline ?? quest.readingDeadline,
      quizOpensAt: payload.quizOpensAt ?? quest.quizOpensAt,
      quizClosesAt: payload.quizClosesAt ?? quest.quizClosesAt,
      resultsAt: payload.resultsAt ?? quest.resultsAt
    },
    // Only when this edit moves those dates, so older live quests stay editable (§13.6).
    { requireResultsBuffer: 'quizClosesAt' in payload || 'resultsAt' in payload }
  );
  if (issues) throw badDates(issues);

  const book =
    payload.book && 'coverUrl' in payload.book
      ? { ...payload.book, coverUrl: toStoredCoverUrl(payload.book.coverUrl) }
      : payload.book;

  // Only when the cover actually changes, and only if the old one is ours — pasted URLs aren't ours to delete.
  const replacedCoverId =
    // Both sides normalised: a not-yet-migrated absolute row must not read as "changed" and lose its file.
    book && 'coverUrl' in book && book.coverUrl !== toStoredCoverUrl(quest.book.coverUrl)
      ? coverIdFromUrl(quest.book.coverUrl)
      : null;

  const prizes =
    payload.prizes && 'photoUrl' in payload.prizes
      ? { ...payload.prizes, photoUrl: toStoredCoverUrl(payload.prizes.photoUrl) }
      : payload.prizes;
  const replacedPhotoId =
    prizes && 'photoUrl' in prizes && prizes.photoUrl !== toStoredCoverUrl(quest.prizes?.photoUrl)
      ? coverIdFromUrl(quest.prizes?.photoUrl)
      : null;

  const update: Record<string, unknown> = {};

  for (const field of QUEST_DATE_FIELDS) {
    const value = payload[field];
    if (value) update[field] = value;
  }

  // Dotted paths, so editing one book field does not blank the others.
  for (const [key, value] of Object.entries(book ?? {})) {
    update[`book.${key}`] = value;
  }
  for (const [key, value] of Object.entries(prizes ?? {})) {
    update[`prizes.${key}`] = value;
  }
  if (payload.bookRevealed !== undefined) update.bookRevealed = payload.bookRevealed;
  if ('quizConfig' in payload) {
    const { quizConfig, quizSummary } = await buildQuizConfig(quest, payload.quizConfig ?? null);
    update.quizConfig = quizConfig;
    update.quizSummary = quizSummary;
  }

  const updated = await QuestModel.findByIdAndUpdate(
    questId,
    { $set: update },
    { returnDocument: 'after', runValidators: true }
  );

  if (!updated) throw ApiError.notFound('No such quest.');
  if (replacedCoverId) await discardCover(replacedCoverId);
  if (replacedPhotoId) await discardCover(replacedPhotoId);
  return toAdminQuestDto(updated);
}

/** Once anyone has started, the setup and opening are frozen and the window may only grow (§13.6). */
function assertLockedChangesAllowed(quest: QuestDocument, payload: UpdateQuestPayload): void {
  const locked = (field: string, message: string) =>
    ApiError.conflict(message, { reason: 'quiz_locked', fields: { [field]: message } });
  const frozen = 'Participants have started — the quiz setup can no longer change.';

  if ('quizConfig' in payload) throw locked('quizConfig', frozen);
  if (payload.quizOpensAt && payload.quizOpensAt.getTime() !== quest.quizOpensAt.getTime()) {
    throw locked('quizOpensAt', frozen);
  }
  if (payload.quizClosesAt && payload.quizClosesAt < quest.quizClosesAt) {
    throw locked('quizClosesAt', 'The quiz can only be extended once people have started.');
  }
}

/**
 * The phase is a function of the clock, not a stored column. Deriving it means
 * a missed cron job or a stale record can never leave the Home screen showing
 * "reading" a week after the deadline passed.
 */
export function resolvePhase(quest: QuestDocument, now = new Date()): QuestPhase {
  if (now < quest.opensAt) return 'upcoming';
  if (now < quest.quizOpensAt) return 'reading';
  if (now < quest.quizClosesAt) return 'quiz';
  return 'finished';
}

export function toQuestDto(quest: QuestDocument): Quest {
  return {
    id: quest.id,
    edition: quest.edition,
    year: quest.year,
    phase: resolvePhase(quest),
    bookRevealed: isBookRevealed(quest),
    // Withheld at the source: a `?` drawn over a cover already in the payload would leak it.
    book: isBookRevealed(quest) ? toBookDto(quest) : null,
    prizes: toPrizesDto(quest),
    opensAt: quest.opensAt.toISOString(),
    readingDeadline: quest.readingDeadline.toISOString(),
    quizOpensAt: quest.quizOpensAt.toISOString(),
    quizClosesAt: quest.quizClosesAt.toISOString(),
    resultsAt: quest.resultsAt.toISOString(),
    quiz: quest.quizSummary
      ? { questionCount: quest.quizSummary.questionCount, totalSeconds: quest.quizSummary.totalSeconds }
      : null,
    participantCount: quest.participantCount
  };
}

/** Admin-only: the editor needs the setup, which public `/quests/current` must never carry. */
export function toAdminQuestDto(quest: QuestDocument): AdminQuest {
  const config = quest.quizConfig;
  return {
    ...toQuestDto(quest),
    book: toBookDto(quest),
    quizConfig: config
      ? {
          distribution: config.distribution,
          quizIds: config.quizzes.map(String),
          groupLabels: groupLabels(config.distribution, config.quizzes.length)
        }
      : null
  };
}

export function toQuestSummary(quest: QuestRow, winner: QuestSummary['winner']): QuestSummary {
  return {
    id: String(quest._id),
    edition: quest.edition,
    year: quest.year,
    bookTitle: quest.book.title,
    bookAuthor: quest.book.author,
    coverUrl: toPublicCoverUrl(quest.book.coverUrl),
    participantCount: quest.participantCount,
    prizes: toPrizesDto(quest),
    winner
  };
}

/* ── Internals ───────────────────────────────────────────────────────────── */

const isBookRevealed = (quest: QuestDocument): boolean => quest.bookRevealed !== false;

/** Missing places and photo on older rows read as null; no migration needed. */
function toPrizesDto(quest: QuestDocument | QuestRow): Prizes {
  const prizes = quest.prizes;
  return {
    first: prizes?.first ?? null,
    second: prizes?.second ?? null,
    third: prizes?.third ?? null,
    fourth: prizes?.fourth ?? null,
    fifth: prizes?.fifth ?? null,
    photoUrl: toPublicCoverUrl(prizes?.photoUrl)
  };
}

function toBookDto(quest: QuestDocument): Book {
  return {
    title: quest.book.title,
    author: quest.book.author,
    pages: quest.book.pages,
    coverUrl: toPublicCoverUrl(quest.book.coverUrl),
    description: quest.book.description ?? null,
    resources: (quest.book.resources ?? []).map((resource) => ({
      label: resource.label,
      url: resource.url,
      kind: resource.kind
    }))
  };
}

/** One query for the winning results, one for their names — never N+1. */
async function findWinners(questIds: string[]): Promise<Map<string, QuestSummary['winner']>> {
  const winners = new Map<string, QuestSummary['winner']>();
  if (questIds.length === 0) return winners;

  const results = await ResultModel.find({ quest: { $in: questIds }, rank: 1 })
    .select('quest participant')
    .lean();
  const byId = await participantsById(results.map((result) => result.participant));

  for (const result of results) {
    const participant = byId.get(String(result.participant));
    if (participant) winners.set(String(result.quest), participant);
  }

  return winners;
}

function badDates(issues: Record<string, string>): ApiError {
  const first = Object.values(issues)[0] ?? 'Those dates do not line up.';
  return ApiError.badRequest(first, issues);
}

const encodeCursor = (edition: number): string => Buffer.from(String(edition)).toString('base64url');

function decodeCursor(cursor: string | undefined): number | null {
  if (!cursor) return null;
  const edition = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  return Number.isFinite(edition) ? edition : null;
}
