import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { QUIZ_ANSWER_GRACE_MS, type AttemptState, type PutAttemptItemPayload } from '@bookquest/shared';
import { api, ApiRequestError } from '@/lib/api/client';
import { withRetry } from '@/lib/api/retry';
import { serverNow, timed } from '../lib/serverClock';
import { quizKeys } from './quizKeys';

const TIMEOUT_MS = 8000;
const CLIENT_ID_KEY = 'bq.quiz.clientId';

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

function writeState(queryClient: QueryClient, state: AttemptState): AttemptState {
  const kept = newest(queryClient.getQueryData<AttemptState>(quizKeys.attempt()), state);
  queryClient.setQueryData(quizKeys.attempt(), kept);
  // Progress and status changed, so the overview is stale either way.
  if (kept.phase === 'completed' || kept.phase === 'voided') void queryClient.invalidateQueries({ queryKey: quizKeys.me() });
  return kept;
}

/** Failure tracking for the connection banner: set on the first transient failure, cleared on any success. */
type Health = { onFail: (error: unknown) => void; onOk: () => void };

function call<T extends { serverNow: string }>(
  health: Health,
  run: () => Promise<T>,
  until?: () => boolean
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
    { until }
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

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'retrying';

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

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
          () => api.put<AttemptState>(`/quiz/attempt/items/${index}`, { ...body, clientId }, { timeoutMs: TIMEOUT_MS }),
          pastCutoff
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
  }>({ inFlight: false, queued: null, lockedIndex: null, unsent: null });

  const select = useCallback(
    async (pending: Pending) => {
      const lane = selection.current;
      if (lane.lockedIndex === pending.index) return;
      lane.unsent = null;
      if (lane.inFlight) {
        lane.queued = pending;
        return;
      }
      lane.inFlight = true;
      let current: Pending | null = pending;
      let last: SendResult | null = null;
      while (current) {
        setSaveStatus('saving');
        last = await send(current);
        if (last === 'offline' && !lane.queued) lane.unsent = current;
        current = lane.queued;
        lane.queued = null;
      }
      lane.inFlight = false;
      // A lock that went out meanwhile owns the status line.
      if (lane.lockedIndex !== null) return;
      // "Saved" only on a server ack (§6).
      setSaveStatus(typeof last === 'object' && last !== null ? 'saved' : last === 'offline' ? 'retrying' : 'idle');
    },
    [send]
  );

  const lock = useCallback(
    async (pending: Pending): Promise<LockOutcome> => {
      const lane = selection.current;
      lane.queued = null;
      lane.unsent = null;
      lane.lockedIndex = pending.index;
      setSaveStatus('saving');
      const result = await send(pending);
      setSaveStatus('idle');
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
    if (!isLive(pending.index) || lane.lockedIndex === pending.index) {
      lane.unsent = null;
      setSaveStatus('idle');
      return;
    }
    void select(pending);
  }, [isLive, select]);

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
    setSaveStatus('idle');
  }, [questionIndex]);

  onReturn.current = resendUnsent;

  // Mirrors withRetry's state onto the status line while a selection keeps failing.
  const status: SaveStatus = saveStatus === 'saving' && failingSince !== null ? 'retrying' : saveStatus;

  return { query, state: query.data, next, put, lock, select, refetch, saveStatus: status, failingSince };
}
