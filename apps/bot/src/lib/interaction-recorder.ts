import { INTERACTION_LIMITS, type InteractionInput } from '@bookquest/shared';
import { logger } from '../config/logger.js';
import { postInteractions } from './api-client.js';

const FLUSH_EVERY_MS = 2000;
const FLUSH_AT = 50;
/** A long API outage must not grow memory without limit: past this, the oldest go. */
const BUFFER_CAP = 1000;
const RETRY_AFTER_MS = 2000;

const buffer: InteractionInput[] = [];
let timer: NodeJS.Timeout | null = null;
let inFlight: Promise<void> | null = null;
let dropped = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Synchronous and cheap: called from the middleware on every update. */
export function recordInteraction(item: InteractionInput): void {
  buffer.push(item);
  if (buffer.length > BUFFER_CAP) {
    const over = buffer.length - BUFFER_CAP;
    buffer.splice(0, over);
    dropped += over;
  }
  if (buffer.length >= FLUSH_AT) void flushInteractions();
  else schedule();
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => void flushInteractions(), FLUSH_EVERY_MS);
  // Never the reason the process stays alive.
  timer.unref();
}

/** One flush at a time; callers during a flush share it. Anything recorded meanwhile gets the next one. */
export function flushInteractions(): Promise<void> {
  inFlight ??= drain().finally(() => {
    inFlight = null;
    if (buffer.length > 0) schedule();
  });
  return inFlight;
}

async function drain(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (dropped > 0) {
    logger.warn({ dropped }, 'Interaction buffer full; dropped the oldest');
    dropped = 0;
  }
  while (buffer.length > 0) {
    const batch = buffer.splice(0, INTERACTION_LIMITS.batch);
    let outcome = await postInteractions(batch);
    if (outcome === 'retry') {
      await sleep(RETRY_AFTER_MS);
      outcome = await postInteractions(batch);
    }
    if (outcome !== 'ok')
      logger.warn({ count: batch.length, outcome }, 'Dropped an interaction batch');
  }
}
