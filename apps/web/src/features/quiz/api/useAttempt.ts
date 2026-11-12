import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { QUIZ_ANSWER_GRACE_MS, type AttemptState, type PutAttemptItemPayload, type QuizOverview } from '@bookquest/shared';
import { api, ApiRequestError } from '@/lib/api/client';
import { withRetry } from '@/lib/api/retry';
import { serverNow, timed } from '../lib/serverClock';
import { quizKeys } from './quizKeys';

const TIMEOUT_MS = 8000;
// Answers retry sooner: a hung request must not eat the grace window a retry could still land in.
const ANSWER_TIMEOUT_MS = 4000;
const RESEND_AFTER_MS = 3000;
const CLIENT_ID_KEY = 'bq.quiz.clientId';
const PICK_KEY = 'bq.quiz.pick';

/* ── Per-tab client id ──────────────────────────────────────────────────── */

const randomId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;

// Storage can be blocked (private mode, some webviews): a module constant still names this tab.
const FALLBACK_CLIENT_ID = randomId();

function readClientId(): string {
  try {
    const stored = window.sessionStorage.getItem(CLIENT_ID_KEY);
    if (stored) return stored;
    const fresh = randomId();
    window.sessionStorage.setItem(CLIENT_ID_KEY, fresh);
    return fresh;
  } catch {
    return FALLBACK_CLIENT_ID;
  }
}

/* ── Last unacknowledged pick ───────────────────────────────────────────── */

// Local storage, so a tap survives a reload or the webview being killed before the server acked it.
type StoredPick = { attemptId: string; index: number; optionId: string };

function storePick(pick: StoredPick | null): void {
  try {
    if (pick) window.localStorage.setItem(PICK_KEY, JSON.stringify(pick));
    else window.localStorage.removeItem(PICK_KEY);
  } catch {
    // Blocked storage: the in-memory resend still covers this session.
  }
}

function readPick(): StoredPick | null {
  try {
    const raw = window.localStorage.getItem(PICK_KEY);
    return raw ? (JSON.parse(raw) as StoredPick) : null;
  } catch {
    return null;
  }
}

/* ── Shared plumbing ────────────────────────────────────────────────────── */

const isTransient = (error: unknown) =>
  error instanceof ApiRequestError && (error.status === 0 || error.status === 429 || error.status >= 500);

const isAlreadyLocked = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 409 && error.reason === 'already_locked';

/** Every response carries `serverNow`; an older one than what's cached lost a race and is dropped. */
function newest(current: AttemptState | undefined, incoming: AttemptState): AttemptState {
  if (current && Date.parse(current.serverNow) > Date.parse(incoming.serverNow)) return current;
  return incoming;
}

const OVERVIEW_STATE: Partial<Record<AttemptState['phase'], QuizOverview['state']>> = { completed: 'completed', voided: 'voided' };

/**
 * Mirrors the attempt into the cached overview, so `/quiz` never paints a stale "Start quiz"
 * while its refetch is in flight. The refetch then fills in what only the server knows.
 */
function syncOverview(queryClient: QueryClient, state: AttemptState): void {
  queryClient.setQueryData<QuizOverview>(quizKeys.me(), (overview) => {
    if (!overview) return overview;
    const answered = state.phase === 'completed' ? state.position.total : state.position.index;
    return {
      ...overview,
      state: OVERVIEW_STATE[state.phase] ?? 'in_progress',
      attempt: {
        status: state.status,
        answered,
        total: state.position.total,
        score: state.result?.score ?? null,
        durationMs: state.result?.durationMs ?? null,
        voidReason: overview.attempt?.voidReason ?? null,
        reviewAvailable: overview.attempt?.reviewAvailable ?? false
      }
    };
  });
}

function writeState(queryClient: QueryClient, state: AttemptState): AttemptState {
  const kept = newest(queryClient.getQueryData<AttemptState>(quizKeys.attempt()), state);
  queryClient.setQueryData(quizKeys.attempt(), kept);
  syncOverview(queryClient, kept);
  if (kept.phase === 'completed' || kept.phase === 'voided') void queryClient.invalidateQueries({ queryKey: quizKeys.me() });
  return kept;
}

/** Failure tracking for the connection banner: set on the first transient failure, cleared on any success. */
type Health = { onFail: (error: unknown) => void; onOk: () => void };

function call<T extends { serverNow: string }>(
  health: Health,
  run: () => Promise<T>,
  cutoff?: { until: () => boolean; remainingMs: () => number }
): Promise<T> {
  return withRetry(
    async () => {
      try {
        const result = await timed(run);
        health.onOk();
        return result;
      } catch (error) {
        health.onFail(error);
        throw error;
      }
    },
    cutoff ?? {}
  );
}

/* ── Start (used by the overview) ───────────────────────────────────────── */

/** `POST /quiz/attempt`, idempotent: a second tap or tab gets the same attempt. */
export function useStartAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      withRetry(() => timed(() => api.post<AttemptState>('/quiz/attempt', undefined, { timeoutMs: TIMEOUT_MS }))),
    onSuccess: (state) => {
      writeState(queryClient, state);
      void queryClient.invalidateQueries({ queryKey: quizKeys.me() });
    }
  });
}

/* ── Play ───────────────────────────────────────────────────────────────── */

/** What happened to a lock, so the screen knows whether to show "Locked in" or just follow the server. */
export type LockOutcome = 'locked' | 'time_up' | 'superseded' | 'expired' | 'failed';

type SendResult = AttemptState | 'already_locked' | 'expired' | 'offline' | 'rejected';
type PutBody = Omit<PutAttemptItemPayload, 'clientId'>;
type Pending = { index: number; body: PutBody };

/**
 * The attempt as the server sees it, plus the three writes. Every response is
 * written into the cache, so the screen only ever renders server truth; the
 * one optimistic bit (the selection highlight) lives in the screen.
 *
 * Selection ordering: one selection request in flight at a time, and a newer
 * tap replaces any queued one. A lock supersedes pending selections: it drops
 * the queue and goes out at once, never behind a queued tap. A selection still
 * in flight may land after the lock; the server then answers it with
 * `already_locked` (different option) or a replay (same one), both harmless.
 */
export function useAttempt() {
  const queryClient = useQueryClient();
  const [failingSince, setFailingSince] = useState<number | null>(null);

  const health = useRef<Health>({
    onFail: (error) => {
      if (isTransient(error)) setFailingSince((since) => since ?? Date.now());
    },
    onOk: () => setFailingSince(null)
  }).current;

  const query = useQuery({
    queryKey: quizKeys.attempt(),
    queryFn: async ({ signal }) => {
      const state = await call(health, () =>
        api.get<AttemptState>('/quiz/attempt', { timeoutMs: TIMEOUT_MS, signal })
      );
      return newest(queryClient.getQueryData<AttemptState>(quizKeys.attempt()), state);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    // withRetry already retried the transient ones; a 404 (no attempt) is an answer.
    retry: false
  });

  const refetch = useCallback(
    () => queryClient.refetchQueries({ queryKey: quizKeys.attempt() }, { cancelRefetch: false }),
    [queryClient]
  );

  // Assigned below; the listener effect is declared first so it reads the latest.
  const onReturn = useRef<() => void>(() => {});

  // rAF and timers freeze in a hidden tab or a backgrounded webview; catch up the moment we're back.
  useEffect(() => {
    const onEvent = () => void refetch().then(() => onReturn.current());
    const onVisible = () => document.visibilityState === 'visible' && onEvent();
    window.addEventListener('focus', onEvent);
    window.addEventListener('online', onEvent);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onEvent);
      window.removeEventListener('online', onEvent);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refetch]);

  /* next: single-flight, the server serves idempotently anyway */
  const nextFlight = useRef<Promise<AttemptState | null> | null>(null);
  const next = useCallback((): Promise<AttemptState | null> => {
    nextFlight.current ??= call(health, () =>
      api.post<AttemptState>('/quiz/attempt/next', undefined, { timeoutMs: TIMEOUT_MS })
    )
      .then((state) => writeState(queryClient, state))
      .catch(async () => {
        await refetch();
        return null;
      })
      .finally(() => {
        nextFlight.current = null;
      });
    return nextFlight.current;
  }, [health, queryClient, refetch]);

  /* put: retries stop once the answer can no longer count, then the state is refetched */
  const clientId = useRef(readClientId()).current;
  const send = useCallback(
    async ({ index, body }: Pending): Promise<SendResult> => {
      const question = queryClient.getQueryData<AttemptState>(quizKeys.attempt())?.question;
      // Not the live question: the server has moved on, so one try and then refetch, never a retry loop.
      const cutoff = question?.index === index ? Date.parse(question.deadlineAt) + QUIZ_ANSWER_GRACE_MS : -Infinity;
      const pastCutoff = () => serverNow() > cutoff;
      try {
        const state = await call(
          health,
          () => api.put<AttemptState>(`/quiz/attempt/items/${index}`, { ...body, clientId }, { timeoutMs: ANSWER_TIMEOUT_MS }),
          { until: pastCutoff, remainingMs: () => cutoff - serverNow() }
        );
        return writeState(queryClient, state);
      } catch (error) {
        // Resolve only once the refetched truth is in the cache, so callers decide from it.
        await refetch();
        if (isAlreadyLocked(error)) return 'already_locked';
        if (!isTransient(error)) return 'rejected';
        return pastCutoff() ? 'expired' : 'offline';
      }
    },
    [clientId, health, queryClient, refetch]
  );

  const isLive = useCallback(
    (index: number) => queryClient.getQueryData<AttemptState>(quizKeys.attempt())?.question?.index === index,
    [queryClient]
  );

  const selection = useRef<{
    inFlight: boolean;
    queued: Pending | null;
    lockedIndex: number | null;
    /** The latest tap that never got an ack; re-sent on reconnect while its question is live. */
    unsent: Pending | null;
    /** Settles when the in-flight selection loop ends; awaited before moving on at time-up. */
    drained: Promise<void>;
  }>({ inFlight: false, queued: null, lockedIndex: null, unsent: null, drained: Promise.resolve() });

  // A tap that gave up while still online (e.g. 5xx) is retried on a short timer, not only on reconnect.
  const resendTimer = useRef<number | undefined>(undefined);
  const resendRef = useRef<() => void>(() => {});
  const scheduleResend = useCallback(() => {
    window.clearTimeout(resendTimer.current);
    resendTimer.current = window.setTimeout(() => resendRef.current(), RESEND_AFTER_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(resendTimer.current), []);

  const select = useCallback(
    async (pending: Pending) => {
      const lane = selection.current;
      if (lane.lockedIndex === pending.index) return;
      lane.unsent = null;
      const attemptId = queryClient.getQueryData<AttemptState>(quizKeys.attempt())?.attemptId;
      if (attemptId) storePick({ attemptId, index: pending.index, optionId: pending.body.optionId });
      if (lane.inFlight) {
        lane.queued = pending;
        return;
      }
      lane.inFlight = true;
      let drain = () => {};
      lane.drained = new Promise<void>((resolve) => (drain = resolve));
      let current: Pending | null = pending;
      let last: SendResult | null = null;
      let sentFor: Pending = pending;
      while (current) {
        sentFor = current;
        last = await send(current);
        if (last === 'offline' && !lane.queued) lane.unsent = current;
        current = lane.queued;
        lane.queued = null;
      }
      lane.inFlight = false;
      drain();
      // Forget the local copy only once the server holds exactly this tap, or it can no longer count.
      const acked = typeof last === 'object' && last !== null && last.question?.selectedOptionId === sentFor.body.optionId;
      if (acked || !lane.unsent) storePick(null);
      if (lane.unsent && lane.lockedIndex === null && isLive(sentFor.index)) scheduleResend();
    },
    [isLive, queryClient, send, scheduleResend]
  );

  /**
   * Resolves once no tap is waiting to reach the server: the loop in flight has ended and any
   * unacked tap was re-sent (each send retries until its cutoff), so moving on never outruns a save.
   */
  const flushSelection = useCallback(async () => {
    for (let pass = 0; pass < 4; pass++) {
      const lane = selection.current;
      if (lane.inFlight) await lane.drained;
      else if (lane.unsent) resendRef.current();
      // Nothing started (no longer countable) or nothing pending: done.
      if (!selection.current.inFlight) return;
    }
  }, []);

  /** A tap this device made that the server may not hold yet (survives reloads); null when none. */
  const pendingPick = useCallback(
    (index: number): string | null => {
      const stored = readPick();
      const attemptId = queryClient.getQueryData<AttemptState>(quizKeys.attempt())?.attemptId;
      return stored && stored.attemptId === attemptId && stored.index === index ? stored.optionId : null;
    },
    [queryClient]
  );

  const lock = useCallback(
    async (pending: Pending): Promise<LockOutcome> => {
      const lane = selection.current;
      lane.queued = null;
      lane.unsent = null;
      lane.lockedIndex = pending.index;
      storePick(null);
      const result = await send(pending);
      const outcome: LockOutcome =
        result === 'already_locked'
          ? 'superseded'
          : result === 'expired'
            ? 'expired'
            : typeof result !== 'object'
              ? 'failed'
              : result.lastAction?.reason === 'time_up'
                ? 'time_up'
                : result.lastAction?.accepted === false
                  ? 'failed'
                  : 'locked';
      // Didn't land and the question is still live (cache is fresh by now): let the participant answer again.
      if (outcome !== 'locked' && isLive(pending.index)) lane.lockedIndex = null;
      return outcome;
    },
    [isLive, send]
  );

  // Back online or visible: resend a tap that never got an ack, if its question is still live.
  const resendUnsent = useCallback(() => {
    const lane = selection.current;
    const pending = lane.unsent;
    if (!pending || lane.inFlight) return;
    const question = queryClient.getQueryData<AttemptState>(quizKeys.attempt())?.question;
    const countable = question?.index === pending.index && serverNow() <= Date.parse(question.deadlineAt) + QUIZ_ANSWER_GRACE_MS;
    if (!countable || lane.lockedIndex === pending.index) {
      lane.unsent = null;
      return;
    }
    void select(pending);
  }, [queryClient, select]);

  const put = useCallback(
    (index: number, body: PutBody) => (body.lock ? lock({ index, body }) : select({ index, body })),
    [lock, select]
  );

  // A new question opens a fresh selection lane.
  const questionIndex = query.data?.question?.index ?? null;
  useEffect(() => {
    // In place: a selection loop still running holds this same object.
    selection.current.queued = null;
    selection.current.lockedIndex = null;
    selection.current.unsent = null;
  }, [questionIndex]);

  onReturn.current = resendUnsent;
  resendRef.current = resendUnsent;

  // After a reload: a pick the server never acked is re-sent while its question is still live.
  const attemptId = query.data?.attemptId;
  const liveIndex = query.data?.question?.index;
  useEffect(() => {
    const data = queryClient.getQueryData<AttemptState>(quizKeys.attempt());
    const stored = data && readPick();
    if (!data || !stored) return;
    const live = data.question;
    if (!live || stored.attemptId !== data.attemptId || stored.index !== live.index || live.selectedOptionId === stored.optionId) {
      // Nothing left to resend: it landed, the question moved on, or it's another attempt.
      storePick(null);
      return;
    }
    selection.current.unsent = { index: stored.index, body: { optionId: stored.optionId, lock: false } };
    resendUnsent();
    // Once per question this page sees.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, liveIndex]);

  return { query, state: query.data, next, put, lock, select, flushSelection, pendingPick, refetch, failingSince };
}
