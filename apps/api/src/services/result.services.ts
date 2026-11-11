import crypto from 'node:crypto';
import type { QuestResults, ResultEntry } from '@bookquest/shared';
import { ResultModel } from '../models/result.model.js';
import type { QuestDocument } from '../models/quest.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { findCurrentQuestDocument, requireCurrentQuestDocument } from './quest.services.js';
import { participantsById } from './participant-lookup.services.js';

const PODIUM_SIZE = 3;

/**
 * Built leaderboards per quest. Ranks are frozen once published, so this only
 * goes stale when a quest is edited or replaced, which clears it. Holds the
 * promise, so the results-day burst shares one build. Single instance, like the rate limiter.
 */
const leaderboards = new Map<string, Promise<ResultEntry[]>>();

export function clearResultsCache(): void {
  leaderboards.clear();
}

/** Podium public; the full board needs a session (names and numbers, possibly of minors). */
export async function getCurrentQuestResults(viewer: UserDocument | null): Promise<QuestResults> {
  const quest = await requireCurrentQuestDocument();
  requirePublished(quest);

  const leaderboard = await cachedLeaderboard(quest);
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

function cachedLeaderboard(quest: QuestDocument): Promise<ResultEntry[]> {
  const key = String(quest._id);
  const cached = leaderboards.get(key);
  if (cached) return cached;

  const build = buildLeaderboard(quest);
  leaderboards.set(key, build);
  // A failed build must not be served to everyone after it.
  build.catch(() => leaderboards.delete(key));
  return build;
}

async function buildLeaderboard(quest: QuestDocument): Promise<ResultEntry[]> {
  await ensureRanked(quest);

  const results = await ResultModel.find({ quest: quest._id, rank: { $ne: null } })
    .sort({ rank: 1 })
    .select('participant rank score total durationMs')
    .lean();
  const byId = await participantsById(results.map((result) => result.participant));

  return results.flatMap((result) => {
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
}

/**
 * Results that do not exist yet are not found, not forbidden — there is nothing
 * being withheld, the date simply has not arrived.
 */
export function requirePublished(quest: QuestDocument, now = new Date()): void {
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
export function ensureRanked(quest: QuestDocument): Promise<void> {
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
