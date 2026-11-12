import { QUIZ_ANSWER_GRACE_MS, QUIZ_LATENCY_REFUND_MAX_MS, type QuizFlag } from '@bookquest/shared';
import type { AttemptItemRow, AttemptRow } from '../models/quiz-attempt.model.js';

/* Pure attempt maths (§10.2, §11, §12.6): no I/O, so settle, finalise, the
   sweep and re-scoring all agree by construction. */

type Item = Pick<
  AttemptItemRow,
  | 'correctOptionId'
  | 'voided'
  | 'timeLimitMs'
  | 'servedAt'
  | 'deadlineAt'
  | 'selectedOptionId'
  | 'lockedAt'
  | 'outcome'
  | 'signals'
  | 'clientElapsedMs'
>;

type Settled = { outcome: 'auto' | 'timeout'; isCorrect: boolean; elapsedMs: number };

/** The one way attempt write paths are spelled, e.g. `items.3.lockedAt`. */
export function itemPath(index: number, field: keyof AttemptItemRow): string {
  return `items.${index}.${field}`;
}

/* Filter values for `itemPath` keys. MongoDB also reads `items.3` as a field "3"
   on every element, which is missing and so equals null: `{ 'items.3.lockedAt': null }`
   matches a locked item and `$ne: null` never matches. `$type` sees only real
   values, and snapshots write explicit nulls. */
export const IS_NULL = { $type: 'null' } as const;
export const IS_DATE = { $type: 'date' } as const;

export function isItemCorrect(item: Item): boolean {
  return (
    !item.voided &&
    item.selectedOptionId != null &&
    item.selectedOptionId === item.correctOptionId &&
    (item.outcome === 'locked' || item.outcome === 'auto')
  );
}

/**
 * A lock's counted time (§11, revised): the phone's own on-screen time, trusted only between the
 * server's measure (which also holds both network trips) and up to the refund cap below it.
 */
export function lockedElapsed(
  item: Pick<Item, 'servedAt' | 'timeLimitMs' | 'clientElapsedMs'>,
  lockedAt: Date
): number {
  const server = Math.max(0, lockedAt.getTime() - (item.servedAt?.getTime() ?? lockedAt.getTime()));
  const claimed = item.clientElapsedMs;
  const counted = claimed == null ? server : Math.min(server, Math.max(server - QUIZ_LATENCY_REFUND_MAX_MS, claimed));
  return Math.min(counted, item.timeLimitMs);
}

/**
 * Gaps (server measure minus phone claim, ms) for every lock that reached or passed the refund cap.
 * Real network travel rarely costs that much, so each one is surfaced to admins (flag + Telegram alert).
 */
export function cappedClaims(items: readonly Item[]): number[] {
  const gaps: number[] = [];
  for (const item of items) {
    if (item.outcome !== 'locked' || !item.lockedAt || !item.servedAt || item.clientElapsedMs == null) continue;
    const gap = item.lockedAt.getTime() - item.servedAt.getTime() - item.clientElapsedMs;
    if (gap >= QUIZ_LATENCY_REFUND_MAX_MS) gaps.push(gap);
  }
  return gaps;
}

const isOpenServed = (item: Item): boolean => item.servedAt != null && item.lockedAt == null && item.outcome == null;

/** Outcome for a served, unlocked item whose time is over (or whose window closed). */
export function settleServed(item: Item): Settled | null {
  if (!isOpenServed(item)) return null;
  const outcome = item.selectedOptionId != null ? 'auto' : 'timeout';
  return { outcome, isCorrect: isItemCorrect({ ...item, outcome }), elapsedMs: item.timeLimitMs };
}

/** `graceMs` 0 only when the participant's own client asked to move on, having already flushed its saves. */
export function resolveExpired(item: Item, now: Date, graceMs = QUIZ_ANSWER_GRACE_MS): Settled | null {
  if (!isOpenServed(item) || now.getTime() <= item.deadlineAt!.getTime() + graceMs) return null;
  return settleServed(item);
}

/** Per-question time per §11; never trusts the stored `elapsedMs`. */
function itemElapsed(item: Item): number {
  return item.outcome === 'locked' && item.lockedAt ? lockedElapsed(item, item.lockedAt) : item.timeLimitMs;
}

export function scoreItems(items: readonly Item[]): {
  score: number;
  total: number;
  durationMs: number;
  answered: number;
} {
  let score = 0;
  let total = 0;
  let durationMs = 0;
  let answered = 0;
  for (const item of items) {
    if (item.outcome === 'locked' || item.outcome === 'auto') answered += 1;
    if (item.voided) continue;
    total += 1;
    durationMs += itemElapsed(item);
    if (isItemCorrect(item)) score += 1;
  }
  return { score, total, durationMs, answered };
}

const FAST_LOCK_MS = 1500;
const FAST_MIN_LOCKS = 5;
const FAST_MIN_RATIO = 0.9;
const HIDDEN_TIME_RATIO = 0.3;
const HIDDEN_MIN_COUNT = 10;
const MULTI_CLIENT_MAX = 2;

/** Advisory only (§12.6): surfaced to admins, never an automatic penalty. */
export function computeFlags(attempt: Pick<AttemptRow, 'items' | 'clientIds'>): QuizFlag[] {
  const items = attempt.items as readonly Item[];
  const flags: QuizFlag[] = [];

  if (attempt.clientIds.length > MULTI_CLIENT_MAX) flags.push('multi_client');

  const { score, total } = scoreItems(items);
  const fastLocks = items.filter(
    (item) => item.outcome === 'locked' && item.lockedAt && lockedElapsed(item, item.lockedAt) < FAST_LOCK_MS
  ).length;
  if (fastLocks >= FAST_MIN_LOCKS && total > 0 && score / total >= FAST_MIN_RATIO) flags.push('fast');
  if (cappedClaims(items).length > 0) flags.push('refund_capped');

  let hiddenMs = 0;
  let hiddenCount = 0;
  let limitMs = 0;
  for (const item of items) {
    hiddenMs += item.signals?.hiddenMs ?? 0;
    hiddenCount += item.signals?.hiddenCount ?? 0;
    limitMs += item.timeLimitMs;
  }
  if (hiddenMs > HIDDEN_TIME_RATIO * limitMs || hiddenCount >= HIDDEN_MIN_COUNT) flags.push('hidden');

  return flags;
}
