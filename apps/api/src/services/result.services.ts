import crypto from 'node:crypto';
import type { CertificateData, QuestResults, ResultEntry } from '@bookquest/shared';
import { ResultModel } from '../models/result.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import type { QuestDocument } from '../models/quest.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { findCurrentQuestDocument, requireCurrentQuestDocument } from './quest.services.js';
import { requireParticipantForUser } from './participant.services.js';

const PODIUM_SIZE = 3;

/** Podium public; the full board needs a session (names and numbers, possibly of minors). */
export async function getCurrentQuestResults(viewer: UserDocument | null): Promise<QuestResults> {
  const quest = await requireCurrentQuestDocument();
  requirePublished(quest);
  await ensureRanked(quest);

  const results = await ResultModel.find({ quest: quest._id }).sort({ rank: 1 }).lean();
  const participants = await ParticipantModel.find({
    _id: { $in: results.map((result) => result.participant) }
  })
    .select('number fullName')
    .lean();

  const byId = new Map(participants.map((participant) => [String(participant._id), participant]));

  const leaderboard: ResultEntry[] = results.flatMap((result) => {
    const participant = byId.get(String(result.participant));
    if (!participant || !result.rank) return [];
    return [
      {
        rank: result.rank,
        number: participant.number,
        fullName: participant.fullName,
        score: result.score,
        total: result.total,
        durationMs: result.durationMs
      }
    ];
  });

  const podium = leaderboard.slice(0, PODIUM_SIZE);
  const isFullBoard = viewer !== null;

  return {
    podium,
    leaderboard: isFullBoard ? leaderboard : podium,
    finishedCount: leaderboard.length,
    isFullBoard,
    publishedAt: quest.resultsAt.toISOString()
  };
}

export async function getCertificateForUser(user: UserDocument): Promise<CertificateData> {
  const quest = await requireCurrentQuestDocument();
  requirePublished(quest);
  await ensureRanked(quest);

  const participant = await requireParticipantForUser(user);
  const result = await ResultModel.findOne({ quest: quest._id, participant: participant.id });

  if (!result) throw ApiError.notFound('There is no completed quiz to certify yet.');

  return {
    code: result.certificateCode ?? '',
    fullName: participant.fullName,
    participantNumber: participant.number,
    questEdition: quest.edition,
    questYear: quest.year,
    bookTitle: quest.book.title,
    bookAuthor: quest.book.author,
    rank: result.rank ?? null,
    issuedAt: quest.resultsAt.toISOString()
  };
}

/**
 * Freezes ranks on the current quest before a new edition replaces it: once
 * archived nothing ranks it lazily, so the archive would show no winner.
 * Before `resultsAt` it does nothing — createQuest refuses that swap anyway.
 */
export async function rankOutgoingQuest(now = new Date()): Promise<void> {
  const outgoing = await findCurrentQuestDocument();
  if (outgoing && now >= outgoing.resultsAt) await ensureRanked(outgoing);
}

/* ── Internals ───────────────────────────────────────────────────────────── */

/**
 * Results that do not exist yet are not found, not forbidden — there is nothing
 * being withheld, the date simply has not arrived.
 */
function requirePublished(quest: QuestDocument, now = new Date()): void {
  if (now < quest.resultsAt) {
    throw ApiError.notFound('Results are not published yet.');
  }
}

/**
 * Ranking happens once, the first time anyone looks after `resultsAt`, and is
 * then frozen into the row. Concurrent first reads are safe without a lock:
 * the order is total (ties end on `_id`), so every ranker writes the same
 * ranks, and `$ifNull` keeps whichever certificate code landed first.
 */
const rankingInFlight = new Map<string, Promise<void>>();

// One run per quest per process, so the results-day burst does the work once.
function ensureRanked(quest: QuestDocument): Promise<void> {
  const key = String(quest._id);
  const running = rankingInFlight.get(key);
  if (running) return running;

  const run = rankQuest(quest).finally(() => rankingInFlight.delete(key));
  rankingInFlight.set(key, run);
  return run;
}

async function rankQuest(quest: QuestDocument): Promise<void> {
  const pending = await ResultModel.countDocuments({ quest: quest._id, rank: null });
  if (pending === 0) return;

  const results = await ResultModel.find({ quest: quest._id })
    .sort({ score: -1, durationMs: 1, submittedAt: 1, _id: 1 })
    .select('_id')
    .lean();

  await ResultModel.bulkWrite(
    results.map((result, index) => ({
      updateOne: {
        filter: { _id: result._id },
        update: [
          {
            $set: {
              rank: index + 1,
              certificateCode: { $ifNull: ['$certificateCode', createCertificateCode(quest.edition)] }
            }
          }
        ]
      }
    }))
  );
}

/** Short enough to read aloud, random enough not to be guessable in bulk. */
function createCertificateCode(edition: number): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  const suffix = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
  return `BQ${edition}-${suffix}`;
}
