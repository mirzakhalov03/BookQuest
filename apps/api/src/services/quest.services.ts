import type {
  CreateQuestPayload,
  CursorPage,
  Quest,
  QuestPhase,
  QuestSummary,
  UpdateQuestPayload
} from '@bookquest/shared';
import { QUEST_DATE_FIELDS, findQuestDateIssues } from '@bookquest/shared';
import { QuestModel, type QuestDocument } from '../models/quest.model.js';
import { ResultModel } from '../models/result.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { ApiError } from '../utils/api-error.js';
import { isDuplicateKeyError } from '../utils/mongo.js';
import { withTransaction } from '../utils/transaction.js';
import { coverIdFromUrl, discardCover } from './cover.services.js';

const ARCHIVE_PAGE_SIZE = 20;

export async function getCurrentQuest(): Promise<Quest> {
  return toQuestDto(await requireCurrentQuestDocument());
}

/** Null rather than a throw, for callers where "between editions" is normal. */
export async function findCurrentQuestDocument(): Promise<QuestDocument | null> {
  return QuestModel.findOne({ isCurrent: true });
}

export async function requireCurrentQuestDocument(): Promise<QuestDocument> {
  const quest = await findCurrentQuestDocument();
  if (!quest) throw ApiError.notFound('No quest is running right now.');
  return quest;
}

export async function getQuestByEdition(edition: number): Promise<Quest> {
  const quest = await QuestModel.findOne({ edition });
  if (!quest) throw ApiError.notFound(`There was no edition ${edition}.`);
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
    ...(before === null ? {} : { edition: { $lt: before } })
  })
    .sort({ edition: -1 })
    .limit(limit + 1);

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

export async function createQuest(payload: CreateQuestPayload): Promise<Quest> {
  const { makeCurrent, ...fields } = payload;

  const issues = findQuestDateIssues({
    opensAt: fields.opensAt,
    readingDeadline: fields.readingDeadline,
    quizOpensAt: fields.quizOpensAt,
    quizClosesAt: fields.quizClosesAt,
    resultsAt: fields.resultsAt
  });
  if (issues) throw badDates(issues);

  if (makeCurrent) {
    // Results, ranks and certificates are served only for the current quest; archiving it early loses them.
    const outgoing = await findCurrentQuestDocument();
    if (outgoing && new Date() < outgoing.resultsAt) {
      throw ApiError.conflict(`Results for edition ${outgoing.edition} are not out yet.`);
    }
  }

  try {
    // Inserted inside the callback: a retried transaction must insert afresh, not reuse a rolled-back document.
    const quest = await withTransaction(async (session) => {
      const [created] = await QuestModel.create([{ ...fields, isCurrent: false }], { session });
      if (!created) throw new Error('Quest insert returned no document.');

      if (makeCurrent) {
        // Unset first: the partial unique index allows one current quest at any instant.
        await QuestModel.updateMany({ isCurrent: true }, { $set: { isCurrent: false } }, { session });
        await QuestModel.updateOne({ _id: created._id }, { $set: { isCurrent: true } }, { session });
        created.isCurrent = true;
      }
      return created;
    });
    return toQuestDto(quest);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw ApiError.conflict(`Edition ${fields.edition} already exists.`);
    }
    throw error;
  }
}

export async function updateQuest(questId: string, payload: UpdateQuestPayload): Promise<Quest> {
  const quest = await QuestModel.findById(questId);
  if (!quest) throw ApiError.notFound('No such quest.');

  /* Ordering is checked against the merged result, not the payload: a partial
     edit is only valid in the context of the dates it does not touch. */
  const issues = findQuestDateIssues({
    opensAt: payload.opensAt ?? quest.opensAt,
    readingDeadline: payload.readingDeadline ?? quest.readingDeadline,
    quizOpensAt: payload.quizOpensAt ?? quest.quizOpensAt,
    quizClosesAt: payload.quizClosesAt ?? quest.quizClosesAt,
    resultsAt: payload.resultsAt ?? quest.resultsAt
  });
  if (issues) throw badDates(issues);

  // Only when the cover actually changes, and only if the old one is ours — pasted URLs aren't ours to delete.
  const replacedCoverId =
    payload.book && 'coverUrl' in payload.book && payload.book.coverUrl !== quest.book.coverUrl
      ? coverIdFromUrl(quest.book.coverUrl)
      : null;

  const update: Record<string, unknown> = {};

  for (const field of QUEST_DATE_FIELDS) {
    const value = payload[field];
    if (value) update[field] = value;
  }

  // Dotted paths, so editing one book field does not blank the others.
  for (const [key, value] of Object.entries(payload.book ?? {})) {
    update[`book.${key}`] = value;
  }
  for (const [key, value] of Object.entries(payload.prizes ?? {})) {
    update[`prizes.${key}`] = value;
  }
  if ('quizQuestionCount' in payload) update.quizQuestionCount = payload.quizQuestionCount;
  if ('quizDurationMinutes' in payload) update.quizDurationMinutes = payload.quizDurationMinutes;

  const updated = await QuestModel.findByIdAndUpdate(
    questId,
    { $set: update },
    { returnDocument: 'after', runValidators: true }
  );

  if (!updated) throw ApiError.notFound('No such quest.');
  if (replacedCoverId) await discardCover(replacedCoverId);
  return toQuestDto(updated);
}

/**
 * Switching the current quest. Unset first, then set: a partial unique index
 * forbids two current quests, so the other order would be rejected by the
 * database. Inside a transaction the gap is invisible; without one it is a few
 * milliseconds where Home reports "no quest running", which is recoverable —
 * two current quests would not be.
 */
export async function makeQuestCurrent(questId: string): Promise<Quest> {
  const target = await QuestModel.findById(questId);
  if (!target) throw ApiError.notFound('No such quest.');

  await withTransaction(async (session) => {
    await QuestModel.updateMany(
      { isCurrent: true, _id: { $ne: target._id } },
      { $set: { isCurrent: false } },
      { session }
    );
    await QuestModel.updateOne({ _id: target._id }, { $set: { isCurrent: true } }, { session });
  });

  return getQuestByEdition(target.edition);
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
    book: {
      title: quest.book.title,
      author: quest.book.author,
      pages: quest.book.pages,
      coverUrl: quest.book.coverUrl ?? null,
      description: quest.book.description ?? null,
      resources: (quest.book.resources ?? []).map((resource) => ({
        label: resource.label,
        url: resource.url,
        kind: resource.kind
      }))
    },
    prizes: {
      first: quest.prizes?.first ?? null,
      second: quest.prizes?.second ?? null,
      third: quest.prizes?.third ?? null
    },
    opensAt: quest.opensAt.toISOString(),
    readingDeadline: quest.readingDeadline.toISOString(),
    quizOpensAt: quest.quizOpensAt.toISOString(),
    quizClosesAt: quest.quizClosesAt.toISOString(),
    resultsAt: quest.resultsAt.toISOString(),
    quizQuestionCount: quest.quizQuestionCount ?? null,
    quizDurationMinutes: quest.quizDurationMinutes ?? null,
    participantCount: quest.participantCount
  };
}

export function toQuestSummary(
  quest: QuestDocument,
  winner: QuestSummary['winner']
): QuestSummary {
  return {
    id: quest.id,
    edition: quest.edition,
    year: quest.year,
    bookTitle: quest.book.title,
    bookAuthor: quest.book.author,
    coverUrl: quest.book.coverUrl ?? null,
    participantCount: quest.participantCount,
    winner
  };
}

/* ── Internals ───────────────────────────────────────────────────────────── */

/** One query for the winning results, one for their names — never N+1. */
async function findWinners(questIds: string[]): Promise<Map<string, QuestSummary['winner']>> {
  const winners = new Map<string, QuestSummary['winner']>();
  if (questIds.length === 0) return winners;

  const results = await ResultModel.find({ quest: { $in: questIds }, rank: 1 })
    .select('quest participant')
    .lean();
  if (results.length === 0) return winners;

  const participants = await ParticipantModel.find({
    _id: { $in: results.map((result) => result.participant) }
  })
    .select('number fullName')
    .lean();

  const byId = new Map(participants.map((participant) => [String(participant._id), participant]));

  for (const result of results) {
    const participant = byId.get(String(result.participant));
    if (participant) {
      winners.set(String(result.quest), {
        number: participant.number,
        fullName: participant.fullName
      });
    }
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
