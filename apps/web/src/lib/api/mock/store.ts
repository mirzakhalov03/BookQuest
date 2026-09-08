import { PARTICIPANT_NUMBER_MIN } from '@bookquest/shared';
import type { Participant, Quest, QuestPhase, Role, SessionUser } from '@bookquest/shared';
import { CURRENT_QUEST, PAST_EDITIONS, SESSION_USER, type PastEdition } from './fixtures';
import { buildRoster } from './people';

/**
 * The mock's world, and the controls that bend it.
 *
 * Kept in `sessionStorage` rather than a module variable so a reload does not
 * undo a registration — the number you were just allocated is still yours, and
 * registering again still conflicts. Per-tab, which is the right scope: two
 * tabs are two independent playgrounds.
 *
 * Nothing here is a flag pretending to be a state. `phase`, "registration is
 * closed" and "results are out" are all read off the quest's dates, exactly as
 * the API derives them, so a control moves a date rather than inventing a mode.
 */

const STORAGE_KEY = 'bookquest.mock';

export interface MockState {
  token: string;
  expiresAt: string;
  /** `participant` stays null here — the roster is the single source for it. */
  user: SessionUser;
  quest: Quest;
  archive: PastEdition[];
  participants: Participant[];
  myParticipantId: string | null;
  /** False is the between-editions state: every current-quest route 404s. */
  questRunning: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

function initialState(): MockState {
  return {
    token: `mock.${Math.random().toString(36).slice(2)}`,
    expiresAt: new Date(Date.now() + 7 * DAY).toISOString(),
    user: SESSION_USER,
    quest: CURRENT_QUEST,
    archive: PAST_EDITIONS,
    participants: buildRoster(CURRENT_QUEST.id, PARTICIPANT_NUMBER_MIN),
    myParticipantId: null,
    questRunning: true
  };
}

let state: MockState | null = null;

function load(): MockState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    // Storage blocked or holding something else. A fresh world is fine; it
    // just will not survive the next reload.
  }
  return initialState();
}

function persist(next: MockState): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // In-memory only from here on.
  }
}

export function getState(): MockState {
  state ??= load();
  return state;
}

/** Mutate and write through in one step, so no caller can forget the second half. */
export function updateState(mutate: (draft: MockState) => void): MockState {
  const next = getState();
  mutate(next);
  persist(next);
  return next;
}

/* ── Derived reads ───────────────────────────────────────────────────────── */

/**
 * The same derivation the API does: the phase is a function of the clock, and
 * the count is a function of the roster. Neither is ever stored.
 */
export function readQuest(quest: Quest, participantCount: number): Quest {
  return { ...quest, phase: resolvePhase(quest), participantCount };
}

export function resolvePhase(quest: Quest, now = Date.now()): QuestPhase {
  if (now < Date.parse(quest.opensAt)) return 'upcoming';
  if (now < Date.parse(quest.quizOpensAt)) return 'reading';
  if (now < Date.parse(quest.quizClosesAt)) return 'quiz';
  return 'finished';
}

/** Registration closes when the reading period ends (TBD-2). */
export const isRegistrationOpen = (quest: Quest, now = Date.now()): boolean =>
  now < Date.parse(quest.readingDeadline);

export const areResultsPublished = (quest: Quest, now = Date.now()): boolean =>
  now >= Date.parse(quest.resultsAt);

/** The session user with their registration attached, the way `/auth/me` answers. */
export function readUser(current: MockState): SessionUser {
  const participant =
    current.participants.find((entry) => entry.id === current.myParticipantId) ?? null;
  return { ...current.user, participant };
}

/* ── Controls ────────────────────────────────────────────────────────────── */

/**
 * A reload after every change is deliberate. The session, the React Query
 * cache and the boot sequence all read this state once at start-up, and a
 * clean boot is a far more honest way to see the change than trying to
 * invalidate the right queries from outside React.
 */
function commit(mutate: (draft: MockState) => void): void {
  updateState(mutate);
  window.location.reload();
}

export interface MockControls {
  /** The whole world, for poking at in the console. */
  state: () => MockState;
  /** 'admin' (the default) or 'participant' — the guards in both directions. */
  setRole: (role: Role) => void;
  /** Rewrites the quest's dates around now so the app is in that phase. */
  setPhase: (phase: QuestPhase) => void;
  /** False makes every current-quest route answer 404. */
  setQuestRunning: (running: boolean) => void;
  /** Moves `resultsAt` into the past, so results and certificates exist. */
  publishResults: () => void;
  /** Back to the fixtures: not registered, admin, reading phase. */
  reset: () => void;
}

export const mockControls: MockControls = {
  state: getState,

  setRole: (role) =>
    commit((draft) => {
      draft.user = { ...draft.user, role };
    }),

  setPhase: (phase) =>
    commit((draft) => {
      draft.quest = { ...draft.quest, ...datesForPhase(phase) };
    }),

  setQuestRunning: (running) =>
    commit((draft) => {
      draft.questRunning = running;
    }),

  publishResults: () =>
    commit((draft) => {
      const now = Date.now();
      draft.quest = {
        ...draft.quest,
        ...datesForPhase('finished'),
        resultsAt: new Date(now - 60_000).toISOString()
      };
    }),

  reset: () =>
    commit((draft) => {
      Object.assign(draft, initialState());
    })
};

/**
 * Offsets in days from now, keeping the ordering the API enforces:
 * `opensAt < readingDeadline <= quizOpensAt < quizClosesAt <= resultsAt`.
 */
function datesForPhase(
  phase: QuestPhase
): Pick<Quest, 'opensAt' | 'readingDeadline' | 'quizOpensAt' | 'quizClosesAt' | 'resultsAt'> {
  const now = Date.now();
  const at = (days: number) => new Date(now + days * DAY).toISOString();

  switch (phase) {
    case 'upcoming':
      return {
        opensAt: at(3),
        readingDeadline: at(53),
        quizOpensAt: at(54),
        quizClosesAt: at(54.1),
        resultsAt: at(55)
      };
    case 'reading':
      return {
        opensAt: at(-39),
        readingDeadline: at(11),
        quizOpensAt: at(12),
        quizClosesAt: at(12.1),
        resultsAt: at(13)
      };
    case 'quiz':
      return {
        opensAt: at(-51),
        readingDeadline: at(-1),
        quizOpensAt: at(-0.02),
        quizClosesAt: at(0.06),
        resultsAt: at(1)
      };
    case 'finished':
      return {
        opensAt: at(-53),
        readingDeadline: at(-3),
        quizOpensAt: at(-2),
        quizClosesAt: at(-1.9),
        resultsAt: at(1)
      };
  }
}
