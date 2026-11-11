/**
 * Quiz concurrency and load drill (§17). Dev/test databases only.
 *
 *   pnpm --filter @bookquest/api drill:quiz -- --n 150 [--api http://localhost:4100/api/v1] [--close] [--force]
 *   pnpm --filter @bookquest/api drill:quiz -- --cleanup
 *
 * A run seeds N participants with sessions, opens the window, drives N concurrent
 * takers over HTTP against an API started separately, then asserts from the DB.
 * The quest's original dates are saved on the first run and restored by --cleanup.
 */
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import mongoose, { type Types } from 'mongoose';
import { PARTICIPANT_NUMBER_MAX, PARTICIPANT_NUMBER_MIN, QUIZ_ANSWER_GRACE_MS, QUIZ_RESULTS_BUFFER_MS } from '@bookquest/shared';
import { env, isProduction } from '../config/env.js';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { CounterModel, nextSequence } from '../models/counter.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { QuestModel, type QuestDocument } from '../models/quest.model.js';
import { QuizAttemptModel, type AttemptRow } from '../models/quiz-attempt.model.js';
import { ResultModel } from '../models/result.model.js';
import { UserModel } from '../models/user.model.js';
import { runQuizSweep } from '../services/quiz-attempt.services.js';
import { IS_DATE, scoreItems } from '../services/quiz-scoring.js';
import { ensureRanked } from '../services/result.services.js';
import { signSessionToken } from '../utils/token.js';

const DRILL_USERNAME = 'quiz-drill';
const STATE_COLLECTION = 'quizdrill_state';
const WINDOW_MS = 20 * 60_000;
const THINK_MS = { min: 300, max: 8000 };
const ABORT_AFTER_MS = 5;
const BURST_LOCKS = 10;
const P95_BUDGET_MS = 300;
// Long enough to ride out an API restart.
const RETRY_FOR_MS = 120_000;
const LEAK_PATTERN = /"(correctOptionId|isCorrect|explanation|difficulty)"\s*:/;

/* ── Args & safety ──────────────────────────────────────────────────────── */

const argv = process.argv.slice(2).filter((arg) => arg !== '--');
const flag = (name: string): boolean => argv.includes(`--${name}`);
function option(name: string): string | undefined {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : undefined;
}

const args = {
  n: Number(option('n') ?? 150),
  api: (option('api') ?? `http://localhost:${env.PORT}/api/v1`).replace(/\/+$/, ''),
  close: flag('close'),
  cleanup: flag('cleanup'),
  force: flag('force')
};

function databaseName(uri: string): string {
  return decodeURIComponent(new URL(uri).pathname.replace(/^\//, ''));
}

/** Production never; otherwise only a database named for dev/test, unless --force. */
function assertSafeTarget(): void {
  if (isProduction) throw new Error('quiz-drill refuses to run with NODE_ENV=production.');
  const name = databaseName(env.MONGODB_URI);
  if (!/dev|test/i.test(name) && !args.force) {
    throw new Error(`quiz-drill refuses database "${name}": its name must contain "dev" or "test" (or pass --force).`);
  }
  if (!Number.isInteger(args.n) || args.n < 1) throw new Error('--n must be a positive integer.');
}

/* ── Setup ──────────────────────────────────────────────────────────────── */

type Taker = { index: number; userId: Types.ObjectId; participantId: Types.ObjectId; token: string };

const stateCollection = () => mongoose.connection.collection<{ _id: Types.ObjectId } & Record<string, unknown>>(STATE_COLLECTION);

async function requireCurrentQuest(): Promise<QuestDocument> {
  const quest = await QuestModel.findOne({ isCurrent: true });
  if (!quest) throw new Error('No current quest. Run `seed` first.');
  return quest;
}

async function openWindow(quest: QuestDocument): Promise<void> {
  // First run only, so repeated runs keep the real dates for --cleanup.
  await stateCollection().updateOne(
    { _id: quest._id },
    { $setOnInsert: { quizOpensAt: quest.quizOpensAt, quizClosesAt: quest.quizClosesAt, resultsAt: quest.resultsAt } },
    { upsert: true }
  );
  const now = Date.now();
  const quizClosesAt = new Date(now + WINDOW_MS);
  await QuestModel.updateOne(
    { _id: quest._id },
    {
      $set: {
        quizOpensAt: new Date(now - 5_000),
        quizClosesAt,
        resultsAt: new Date(quizClosesAt.getTime() + QUIZ_RESULTS_BUFFER_MS)
      }
    }
  );
}

function ensureQuizAttached(quest: QuestDocument): void {
  if (quest.quizConfig) return;
  console.log('Quest has no quiz attached; running seed:quiz…');
  execFileSync('pnpm', ['--filter', '@bookquest/api', 'seed:quiz'], { stdio: 'inherit', env: process.env });
}

async function createTakers(quest: QuestDocument, count: number, runTag: string): Promise<Taker[]> {
  const users = await UserModel.insertMany(
    Array.from({ length: count }, () => ({ firstName: 'Drill', lastName: runTag, username: DRILL_USERNAME }))
  );
  const numbers: number[] = [];
  for (let i = 0; i < count; i += 1) numbers.push(await nextSequence(`participant:${quest.id}`, PARTICIPANT_NUMBER_MIN));
  if (numbers.at(-1)! > PARTICIPANT_NUMBER_MAX) {
    throw new Error('Participant numbers exhausted. Run --cleanup to free drill numbers.');
  }
  const participants = await ParticipantModel.insertMany(
    users.map((user, i) => ({
      number: numbers[i],
      fullName: `Drill Taker ${numbers[i]}`,
      contact: { method: 'phone', value: `+99899${String(numbers[i]).padStart(7, '0')}` },
      quest: quest._id,
      user: user._id
    }))
  );
  await QuestModel.updateOne({ _id: quest._id }, { $inc: { participantCount: count } });
  // One token per taker: per-user rate limits must see distinct users.
  const tokens = await Promise.all(users.map((user) => signSessionToken(user.id)));
  return users.map((user, i) => ({
    index: i,
    userId: user._id,
    participantId: participants[i]!._id,
    token: tokens[i]!.token
  }));
}

/* ── HTTP client with metrics ───────────────────────────────────────────── */

type Reply = { status: number; data: any; reason: string | undefined };

const metrics = {
  latencies: [] as number[],
  byRoute: new Map<string, number[]>(),
  statuses: new Map<number, number>(),
  serverErrors: [] as string[],
  networkRetries: 0,
  leaks: [] as string[],
  aborted: 0
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const routeOf = (method: string, path: string) => `${method} ${path.replace(/\/\d+$/, '/:index')}`;

function record(route: string, status: number, ms: number, text: string): void {
  metrics.latencies.push(ms);
  const list = metrics.byRoute.get(route) ?? [];
  list.push(ms);
  metrics.byRoute.set(route, list);
  metrics.statuses.set(status, (metrics.statuses.get(status) ?? 0) + 1);
  if (status >= 500) metrics.serverErrors.push(`${route} → ${status}: ${text.slice(0, 200)}`);
  if (LEAK_PATTERN.test(text)) metrics.leaks.push(`${route}: ${text.slice(0, 200)}`);
}

/** Retries network failures (a restarting API), 429s and 5xx; returns null only for a deliberate abort. */
async function call(
  token: string,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
  abortAfterMs?: number
): Promise<Reply | null> {
  const route = routeOf(method, path);
  const giveUpAt = Date.now() + RETRY_FOR_MS;
  for (let attempt = 0; ; attempt += 1) {
    const controller = abortAfterMs != null ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), abortAfterMs) : undefined;
    const started = performance.now();
    try {
      const response = await fetch(`${args.api}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal
      });
      const text = await response.text();
      record(route, response.status, performance.now() - started, text);
      const parsed = text ? JSON.parse(text) : {};
      if (response.status === 429) {
        await sleep(Number(response.headers.get('retry-after') ?? 1) * 1000);
        continue;
      }
      if (response.status >= 500 && Date.now() < giveUpAt) {
        await sleep(500);
        continue;
      }
      return { status: response.status, data: parsed.data, reason: parsed.error?.reason };
    } catch (error) {
      if (controller?.signal.aborted) {
        metrics.aborted += 1;
        return null;
      }
      if (Date.now() >= giveUpAt) throw error;
      metrics.networkRetries += 1;
      await sleep(Math.min(250 * 2 ** attempt, 2000));
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ── Takers ─────────────────────────────────────────────────────────────── */

type Profile = 'plain' | 'expire' | 'triple' | 'abort' | 'reselect';
type TakerLog = {
  profile: Profile;
  accepted: Map<number, string>;
  expiredIndex: number | null;
  abandonAt: number | null;
  done: boolean;
};

// 5% expire, 5% triple lock, 5% abort-then-retry, 10% reselect twice.
function profileOf(index: number): Profile {
  const slot = index % 20;
  if (slot === 0) return 'expire';
  if (slot === 1) return 'triple';
  if (slot === 2) return 'abort';
  if (slot === 3 || slot === 4) return 'reselect';
  return 'plain';
}

/** --close leaves every other taker mid-attempt, so the sweep has something to finalise. */
function abandonPointOf(index: number): number | null {
  if (!args.close || index % 2 === 0) return null;
  // -1: started but never asked for a question (zero answered, so no Result).
  return index === 1 ? -1 : Math.floor(Math.random() * 20);
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

async function lockAnswer(taker: Taker, log: TakerLog, index: number, optionId: string, clientId: string) {
  const path = `/quiz/attempt/items/${index}`;
  const body = { optionId, lock: true, clientId };
  let replies: (Reply | null)[];
  if (log.profile === 'triple') {
    replies = await Promise.all([0, 1, 2].map(() => call(taker.token, 'PUT', path, body)));
  } else {
    if (log.profile === 'abort') await call(taker.token, 'PUT', path, body, ABORT_AFTER_MS);
    replies = [await call(taker.token, 'PUT', path, body)];
  }
  if (replies.some((reply) => reply?.status === 200 && reply.data?.lastAction?.accepted)) log.accepted.set(index, optionId);
  // A lost race refetches, as the client would.
  if (replies.some((reply) => reply?.status === 409)) await call(taker.token, 'GET', '/quiz/attempt');
}

async function runTaker(taker: Taker, log: TakerLog): Promise<void> {
  const clientId = crypto.randomUUID();
  await call(taker.token, 'GET', '/quiz/me');
  const started = await call(taker.token, 'POST', '/quiz/attempt');
  if (!started || started.status >= 400) throw new Error(`start failed: ${started?.status} ${started?.reason ?? ''}`);
  if (log.abandonAt === -1) return;

  const total: number = started.data.position.total;
  for (let guard = 0; guard < total * 3; guard += 1) {
    const reply = await call(taker.token, 'POST', '/quiz/attempt/next');
    const state = reply?.data;
    if (!state || state.status !== 'in_progress') break;
    const question = state.question;
    if (!question) continue;
    if (log.abandonAt === question.index) return;

    const offset = Date.parse(state.serverNow) - Date.now();
    await sleep(randomBetween(THINK_MS.min, THINK_MS.max));
    const path = `/quiz/attempt/items/${question.index}`;

    if (log.profile === 'expire' && log.expiredIndex === question.index) {
      // Half select first, so both `auto` and `timeout` get exercised.
      if (question.index % 2 === 0) await call(taker.token, 'PUT', path, { optionId: pick(question.options as { id: string }[]).id, lock: false, clientId });
      await sleep(Date.parse(question.deadlineAt) - offset - Date.now() + QUIZ_ANSWER_GRACE_MS + 300);
      continue;
    }
    if (log.profile === 'reselect') {
      for (let k = 0; k < 2; k += 1) {
        await call(taker.token, 'PUT', path, { optionId: pick(question.options as { id: string }[]).id, lock: false, clientId });
      }
    }
    await lockAnswer(taker, log, question.index, pick(question.options as { id: string }[]).id, clientId);
  }
  log.done = true;
}

/** Ten identical locks at once must advance the cursor exactly once. */
async function burstProbe(taker: Taker): Promise<{ before: number; after: number; outcome: string | null }> {
  await call(taker.token, 'POST', '/quiz/attempt');
  const served = await call(taker.token, 'POST', '/quiz/attempt/next');
  const question = served!.data.question;
  const attemptBefore = await QuizAttemptModel.findOne({ participant: taker.participantId }).lean<AttemptRow>();
  const body = { optionId: question.options[0].id, lock: true, clientId: crypto.randomUUID() };
  await Promise.all(
    Array.from({ length: BURST_LOCKS }, () => call(taker.token, 'PUT', `/quiz/attempt/items/${question.index}`, body))
  );
  const attemptAfter = await QuizAttemptModel.findOne({ participant: taker.participantId }).lean<AttemptRow>();
  return {
    before: attemptBefore!.cursor,
    after: attemptAfter!.cursor,
    outcome: attemptAfter!.items[question.index]!.outcome ?? null
  };
}

/* ── Assertions ─────────────────────────────────────────────────────────── */

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

async function assertResults(participantIds: Types.ObjectId[]): Promise<void> {
  const attempts = await QuizAttemptModel.find({ participant: { $in: participantIds } }).lean<AttemptRow[]>();
  const results = await ResultModel.find({ participant: { $in: participantIds } }).lean();
  const resultsBy = new Map<string, typeof results>();
  for (const result of results) {
    const key = String(result.participant);
    resultsBy.set(key, [...(resultsBy.get(key) ?? []), result]);
  }

  const mismatches: string[] = [];
  for (const attempt of attempts.filter((a) => a.status === 'completed')) {
    const expected = scoreItems(attempt.items);
    const own = resultsBy.get(String(attempt.participant)) ?? [];
    if (expected.answered === 0) {
      if (own.length !== 0) mismatches.push(`${attempt._id}: zero answered but has a Result`);
      continue;
    }
    const result = own[0];
    if (own.length !== 1 || !result) mismatches.push(`${attempt._id}: ${own.length} Results`);
    else if (result.score !== expected.score || result.total !== expected.total || result.durationMs !== expected.durationMs) {
      mismatches.push(`${attempt._id}: result ${result.score}/${result.total}/${result.durationMs} ≠ ${expected.score}/${expected.total}/${expected.durationMs}`);
    }
  }
  const completed = attempts.filter((a) => a.status === 'completed').length;
  check('every completed attempt with answered ≥ 1 has exactly one Result equal to scoreItems', mismatches.length === 0, mismatches.slice(0, 3).join('; ') || `${completed} completed, ${results.length} Results`);
}

async function assertRun(takers: Taker[], logs: TakerLog[], burst: Awaited<ReturnType<typeof burstProbe>>): Promise<void> {
  const ids = takers.map((t) => t.participantId);
  const counts = await QuizAttemptModel.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { participant: { $in: ids } } },
    { $group: { _id: '$participant', n: { $sum: 1 } } }
  ]);
  check('exactly one attempt per participant', counts.length === ids.length && counts.every((c) => c.n === 1), `${counts.length}/${ids.length} participants with attempts`);

  await assertResults(ids);

  const badLocks = await QuizAttemptModel.countDocuments({
    participant: { $in: ids },
    items: { $elemMatch: { lockedAt: IS_DATE, outcome: { $ne: 'locked' } } }
  });
  check("no item has lockedAt with outcome ≠ 'locked'", badLocks === 0, `${badLocks} attempts`);

  check('burst probe: 10 identical concurrent locks advanced cursor exactly once', burst.after - burst.before === 1 && burst.outcome === 'locked', `cursor ${burst.before} → ${burst.after}, outcome ${burst.outcome}`);

  // Every lock a taker saw accepted is stored as that taker's locked answer.
  const attempts = new Map(
    (await QuizAttemptModel.find({ participant: { $in: ids } }).lean<AttemptRow[]>()).map((a) => [String(a.participant), a])
  );
  let lost = 0;
  let acceptedTotal = 0;
  let expiredWrong = 0;
  takers.forEach((taker, i) => {
    const attempt = attempts.get(String(taker.participantId));
    const log = logs[i]!;
    for (const [index, optionId] of log.accepted) {
      acceptedTotal += 1;
      const item = attempt?.items[index];
      if (item?.outcome !== 'locked' || item.selectedOptionId !== optionId) lost += 1;
    }
    if (log.expiredIndex != null && log.abandonAt == null) {
      const item = attempt?.items[log.expiredIndex];
      const ok = (item?.outcome === 'auto' || item?.outcome === 'timeout') && item.elapsedMs === item.timeLimitMs;
      if (!ok) expiredWrong += 1;
    }
  });
  check('zero lost answers (every accepted lock is stored as locked with that option)', lost === 0, `${acceptedTotal} accepted locks, ${lost} lost`);
  check('expired questions settled as auto/timeout and charged the full limit', expiredWrong === 0, `${logs.filter((l) => l.expiredIndex != null && l.abandonAt == null).length} expired`);

  if (!args.close) {
    const unfinished = [...attempts.values()].filter((a) => a.status !== 'completed').length;
    check('every taker finished and was finalised', unfinished === 0, `${unfinished} not completed`);
  }

  check('no participant response contains correctOptionId (or isCorrect/explanation/difficulty)', metrics.leaks.length === 0, metrics.leaks[0] ?? `${metrics.latencies.length} responses scanned`);

  const p50 = percentile(metrics.latencies, 50);
  const p95 = percentile(metrics.latencies, 95);
  const p99 = percentile(metrics.latencies, 99);
  check(`p95 latency < ${P95_BUDGET_MS} ms`, p95 < P95_BUDGET_MS, `p50 ${p50.toFixed(1)} · p95 ${p95.toFixed(1)} · p99 ${p99.toFixed(1)} · max ${Math.max(...metrics.latencies).toFixed(1)} ms over ${metrics.latencies.length} calls`);
  check('zero 5xx', metrics.serverErrors.length === 0, metrics.serverErrors[0] ?? '');
}

/* ── --close ────────────────────────────────────────────────────────────── */

/** --close sweeps and ranks quest-wide, which would freeze ranks onto real Results that cleanup can't undo. */
async function assertQuestIsDrillOnly(quest: QuestDocument): Promise<void> {
  const drillUsers = await UserModel.find({ username: DRILL_USERNAME }).distinct('_id');
  const drillParticipants = await ParticipantModel.find({ quest: quest._id, user: { $in: drillUsers } }).distinct('_id');
  const outside = { quest: quest._id, participant: { $nin: drillParticipants } };
  const [results, open] = await Promise.all([
    ResultModel.countDocuments(outside),
    QuizAttemptModel.countDocuments({ ...outside, status: 'in_progress' })
  ]);
  if (results > 0 || open > 0) {
    throw new Error(
      `--close refuses: the current quest has ${results} non-drill Result(s) and ${open} non-drill in-progress attempt(s); sweeping and ranking would permanently change them. Use a quest with drill data only.`
    );
  }
}

async function closeAndRank(takers: Taker[]): Promise<void> {
  const quest = await requireCurrentQuest();
  // Again here: real data may have arrived while the takers ran.
  await assertQuestIsDrillOnly(quest);
  const ids = takers.map((t) => t.participantId);
  const openBefore = await QuizAttemptModel.countDocuments({ quest: quest._id, status: 'in_progress' });
  await QuestModel.updateOne({ _id: quest._id }, { $set: { quizClosesAt: new Date(Date.now() - 3_000) } });
  await runQuizSweep();
  const openAfter = await QuizAttemptModel.countDocuments({ quest: quest._id, status: 'in_progress' });
  check('--close: sweep left zero in_progress attempts', openAfter === 0, `${openBefore} open before, ${openAfter} after`);
  await assertResults(ids);

  await QuestModel.updateOne({ _id: quest._id }, { $set: { resultsAt: new Date() } });
  await ensureRanked(await requireCurrentQuest());
  const ranked = await ResultModel.find({ quest: quest._id }).sort({ rank: 1 }).lean();
  const ranksOk = ranked.every((result, i) => result.rank === i + 1);
  const orderOk = ranked.every((result, i) => {
    const prev = ranked[i - 1];
    if (!prev) return true;
    if (prev.score !== result.score) return prev.score > result.score;
    if (prev.durationMs !== result.durationMs) return prev.durationMs < result.durationMs;
    return prev.submittedAt.getTime() <= result.submittedAt.getTime();
  });
  check('--close: ranks are 1..k with no duplicates, in rank order', ranksOk && orderOk, `k = ${ranked.length}`);
}

/* ── --cleanup ──────────────────────────────────────────────────────────── */

async function cleanup(): Promise<void> {
  const quest = await requireCurrentQuest();
  const users = await UserModel.find({ username: DRILL_USERNAME }).select('_id').lean();
  const userIds = users.map((u) => u._id);
  const participants = await ParticipantModel.find({ user: { $in: userIds } }).select('_id quest').lean();
  const participantIds = participants.map((p) => p._id);

  const attempts = await QuizAttemptModel.deleteMany({ participant: { $in: participantIds } });
  const results = await ResultModel.deleteMany({ participant: { $in: participantIds } });
  const ownParticipants = participants.filter((p) => String(p.quest) === quest.id).length;
  const removedParticipants = await ParticipantModel.deleteMany({ _id: { $in: participantIds } });
  const removedUsers = await UserModel.deleteMany({ _id: { $in: userIds } });
  if (ownParticipants > 0) await QuestModel.updateOne({ _id: quest._id }, { $inc: { participantCount: -ownParticipants } });

  // Hand the drill's numbers back: the counter never drops below a number still in use.
  const highest = await ParticipantModel.findOne({ quest: quest._id }).sort({ number: -1 }).select('number').lean();
  const floor = highest ? highest.number - PARTICIPANT_NUMBER_MIN + 1 : 0;
  await CounterModel.updateOne({ _id: `participant:${quest.id}`, value: { $gt: floor } }, { $set: { value: floor } });

  const saved = await stateCollection().findOne({ _id: quest._id });
  if (saved) {
    const { quizOpensAt, quizClosesAt, resultsAt } = saved;
    await QuestModel.updateOne({ _id: quest._id }, { $set: { quizOpensAt, quizClosesAt, resultsAt } });
    await stateCollection().deleteOne({ _id: quest._id });
  }
  console.log(
    `Cleanup: ${removedUsers.deletedCount} users, ${removedParticipants.deletedCount} participants, ${attempts.deletedCount} attempts, ${results.deletedCount} results removed; quest dates ${saved ? 'restored' : 'untouched (none saved)'}.`
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

async function waitForApi(token: string): Promise<void> {
  const reply = await call(token, 'GET', '/quiz/me');
  if (!reply || reply.status >= 500) throw new Error(`API at ${args.api} is not healthy (${reply?.status}).`);
}

function printLatencyTable(): void {
  console.log('\nLatency by route (ms):');
  for (const [route, values] of [...metrics.byRoute].sort()) {
    console.log(`  ${route.padEnd(34)} n=${String(values.length).padStart(5)}  p50 ${percentile(values, 50).toFixed(1).padStart(6)}  p95 ${percentile(values, 95).toFixed(1).padStart(6)}  max ${Math.max(...values).toFixed(1).padStart(7)}`);
  }
  console.log(`Statuses: ${[...metrics.statuses].sort().map(([s, n]) => `${s}×${n}`).join(' ')} · network retries ${metrics.networkRetries} · deliberate aborts ${metrics.aborted}\n`);
}

async function drill(): Promise<void> {
  let quest = await requireCurrentQuest();
  ensureQuizAttached(quest);
  quest = await requireCurrentQuest();
  if (args.close) await assertQuestIsDrillOnly(quest);
  await openWindow(quest);

  const runTag = `run-${Date.now()}`;
  // The last one is the burst prober.
  const all = await createTakers(quest, args.n + 1, runTag);
  const takers = all.slice(0, args.n);
  const prober = all[args.n]!;
  console.log(`Drill ${runTag}: ${args.n} takers + 1 burst prober against ${args.api} (db ${mongoose.connection.name})${args.close ? ', --close' : ''}`);
  await waitForApi(prober.token);

  const logs: TakerLog[] = takers.map((t) => ({
    profile: profileOf(t.index),
    accepted: new Map(),
    expiredIndex: profileOf(t.index) === 'expire' ? Math.floor(Math.random() * 20) : null,
    abandonAt: abandonPointOf(t.index),
    done: false
  }));

  const started = Date.now();
  const takerRuns = Promise.allSettled(takers.map((t, i) => runTaker(t, logs[i]!)));
  const burst = await burstProbe(prober);
  const proberLog: TakerLog = { profile: 'plain', accepted: new Map(), expiredIndex: null, abandonAt: null, done: false };
  const settled = await Promise.all([takerRuns, runTaker(prober, proberLog).then(() => null, (e: unknown) => e)]);
  const crashed = settled[0].filter((s) => s.status === 'rejected') as PromiseRejectedResult[];
  console.log(`Takers finished in ${((Date.now() - started) / 1000).toFixed(1)} s; ${crashed.length} taker errors${crashed[0] ? `: ${String(crashed[0].reason)}` : ''}${settled[1] ? `; prober error: ${String(settled[1])}` : ''}`);
  printLatencyTable();

  await assertRun([...takers, prober], [...logs, proberLog], burst);
  check('no taker crashed', crashed.length === 0 && !settled[1]);
  if (args.close) await closeAndRank([...takers, prober]);
}

async function main(): Promise<void> {
  assertSafeTarget();
  await connectToDatabase();
  // Belt and braces: the connected database is the one the name check approved.
  if (mongoose.connection.name !== databaseName(env.MONGODB_URI)) throw new Error('Connected to an unexpected database.');

  if (args.cleanup) await cleanup();
  else await drill();

  await disconnectFromDatabase();
  if (!args.cleanup) console.log(failures === 0 ? '\nDRILL PASS' : `\nDRILL FAIL (${failures} checks failed)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error: unknown) => {
  console.error('quiz-drill failed:', error);
  await disconnectFromDatabase().catch(() => undefined);
  process.exit(1);
});
