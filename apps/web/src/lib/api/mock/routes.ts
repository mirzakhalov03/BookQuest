import {
  PARTICIPANT_NUMBER_MAX,
  createQuestSchema,
  findQuestDateIssues,
  registerParticipantSchema,
  updateQuestSchema
} from '@bookquest/shared';
import type {
  AdminStats,
  ApiErrorCode,
  ApiResponse,
  CursorPage,
  Paginated,
  Participant,
  ParticipantPublic,
  Quest,
  QuestDates,
  QuestSummary,
  Session,
  SessionUser
} from '@bookquest/shared';
import { objectId, questSummary } from './fixtures';
import { buildCertificate, buildResults } from './people';
import {
  areResultsPublished,
  getState,
  isRegistrationOpen,
  readQuest,
  readUser,
  resolvePhase,
  updateState,
  type MockState
} from './store';

/**
 * The contract, served locally. One handler per endpoint in
 * `docs/FRONTEND-SPEC.md`, answering the same envelope with the same status
 * codes and — where the real API's copy is known — the same words, so a screen
 * built against this reads identically once the flag comes off.
 */

class MockError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: Record<string, string> | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'MockError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface Context {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  token: string | null;
}

interface Result {
  status: number;
  data: unknown;
}

interface Route {
  method: string;
  path: string;
  handle: (context: Context) => Result;
}

const ok = (data: unknown): Result => ({ status: 200, data });
const created = (data: unknown): Result => ({ status: 201, data });

/* ── Guards, mirroring the API's own copy ────────────────────────────────── */

function requireUser(context: Context): SessionUser {
  const state = getState();
  if (context.token === null || context.token !== state.token) {
    throw new MockError(401, 'unauthorized', 'Sign in with Telegram to continue.');
  }
  return readUser(state);
}

function requireAdmin(context: Context): SessionUser {
  const user = requireUser(context);
  if (user.role !== 'admin') {
    throw new MockError(403, 'forbidden', 'This area is for organisers.');
  }
  return user;
}

function requireCurrentQuest(): Quest {
  const state = getState();
  if (!state.questRunning) {
    throw new MockError(404, 'not_found', 'No quest is running right now.');
  }
  return readQuest(state.quest, state.participants.length);
}

function requirePublishedResults(quest: Quest): void {
  if (!areResultsPublished(quest)) {
    throw new MockError(404, 'not_found', 'Results are not published yet.');
  }
}

/**
 * Zod's structural issues get the API's wording; everything the shared schemas
 * raise is already a sentence written for a person. Same mapping as
 * `validate.middleware.ts`, so `error.fields` is keyed the same way.
 */
interface Issue {
  path: readonly PropertyKey[];
  message: string;
  code?: string;
  keys?: readonly string[];
}

function validationError(issues: readonly Issue[]): MockError {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || 'body';
    fields[key] ??= describe(issue);
  }
  const first = Object.values(fields)[0] ?? 'Please check the details you entered.';
  return new MockError(400, 'validation_failed', first, fields);
}

/** Only the structural issues need rewording; the shared rules already speak English. */
function describe(issue: Issue): string {
  if (issue.code === 'unrecognized_keys') {
    const key = issue.keys?.[0];
    return key
      ? `“${key}” is not something you can set here.`
      : 'Some of those fields are not editable.';
  }
  return issue.message;
}

/* ── Handlers ────────────────────────────────────────────────────────────── */

function login(context: Context): Result {
  const initData = (context.body as { initData?: unknown } | null)?.initData;
  if (typeof initData !== 'string' || initData.length === 0) {
    throw new MockError(401, 'unauthorized', 'That Telegram sign-in could not be verified.');
  }

  const state = getState();
  const session: Session = {
    token: state.token,
    expiresAt: state.expiresAt,
    user: readUser(state)
  };
  return ok(session);
}

function listQuests(context: Context): Result {
  const limit = readInt(context.query.get('limit'), 20, 1, 50);
  const start = readInt(context.query.get('cursor'), 0, 0, Number.MAX_SAFE_INTEGER);
  const { archive } = getState();

  const items = archive.slice(start, start + limit).map(questSummary);
  const next = start + limit;

  const page: CursorPage<QuestSummary> = {
    items,
    nextCursor: next < archive.length ? String(next) : null
  };
  return ok(page);
}

function getQuestByEdition(context: Context): Result {
  const edition = Number(context.params.edition);
  const state = getState();

  if (state.questRunning && state.quest.edition === edition) {
    return ok(readQuest(state.quest, state.participants.length));
  }

  const past = state.archive.find((entry) => entry.quest.edition === edition);
  if (!past) throw new MockError(404, 'not_found', 'No such quest.');

  return ok({ ...past.quest, phase: resolvePhase(past.quest) } satisfies Quest);
}

function register(context: Context): Result {
  const user = requireUser(context);
  const quest = requireCurrentQuest();

  if (!isRegistrationOpen(quest)) {
    throw new MockError(409, 'conflict', 'Registration for this year has closed.');
  }

  const parsed = registerParticipantSchema.safeParse(context.body);
  if (!parsed.success) throw validationError(parsed.error.issues);

  const state = getState();

  if (user.participant) {
    throw new MockError(
      409,
      'conflict',
      `You are already registered as participant ${user.participant.number}.`
    );
  }

  const taken = state.participants.find(
    (entry) => entry.contact.value.toLowerCase() === parsed.data.contact.value.toLowerCase()
  );
  if (taken) {
    throw new MockError(
      409,
      'conflict',
      `That contact is already registered as participant ${taken.number}.`
    );
  }

  const highest = state.participants.reduce((max, entry) => Math.max(max, entry.number), 2999);
  if (highest + 1 > PARTICIPANT_NUMBER_MAX) {
    throw new MockError(409, 'conflict', 'This year’s quest is full.');
  }

  const participant: Participant = {
    id: objectId(`participant:new:${highest + 1}`),
    number: highest + 1,
    fullName: parsed.data.fullName,
    contact: parsed.data.contact,
    questId: quest.id,
    registeredAt: new Date().toISOString()
  };

  updateState((draft) => {
    draft.participants = [...draft.participants, participant];
    draft.myParticipantId = participant.id;
  });

  return created(participant);
}

function myParticipant(context: Context): Result {
  const user = requireUser(context);
  requireCurrentQuest();

  if (!user.participant) {
    throw new MockError(404, 'not_found', 'You have not registered for this quest yet.');
  }
  return ok(user.participant);
}

function myCertificate(context: Context): Result {
  const user = requireUser(context);
  const quest = requireCurrentQuest();
  requirePublishedResults(quest);

  if (!user.participant) {
    throw new MockError(404, 'not_found', 'You have not registered for this quest yet.');
  }

  // Only people who sat the quiz have a result to certify.
  const { leaderboard } = buildResults(quizTakers(getState()), quest);
  const entry = leaderboard.find((row) => row.number === user.participant?.number) ?? null;

  if (!entry) {
    throw new MockError(404, 'not_found', 'There is no completed quiz to certify yet.');
  }

  return ok(buildCertificate(user.participant, quest, entry.rank));
}

function participantByNumber(context: Context): Result {
  requireUser(context);
  const state = getState();
  requireCurrentQuest();

  const number = Number(context.params.number);
  const participant = state.participants.find((entry) => entry.number === number);

  if (!participant) {
    throw new MockError(404, 'not_found', `No participant ${number} in this quest.`);
  }

  const view: ParticipantPublic = { number: participant.number, fullName: participant.fullName };
  return ok(view);
}

function adminParticipants(context: Context): Result {
  requireAdmin(context);
  requireCurrentQuest();

  const term = (context.query.get('q') ?? '').trim().toLowerCase();
  const page = readInt(context.query.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = readInt(context.query.get('limit'), 50, 1, 200);

  const all = [...getState().participants].sort((a, b) => a.number - b.number);
  const matches = term
    ? all.filter(
        (entry) => entry.fullName.toLowerCase().includes(term) || String(entry.number) === term
      )
    : all;

  const result: Paginated<Participant> = {
    items: matches.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total: matches.length
  };
  return ok(result);
}

function adminStats(context: Context): Result {
  requireAdmin(context);
  const quest = requireCurrentQuest();
  const state = getState();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const stats: AdminStats = {
    participants: state.participants.length,
    registeredToday: state.participants.filter(
      (entry) => Date.parse(entry.registeredAt) >= startOfToday.getTime()
    ).length,
    quizSubmitted: areResultsPublished(quest) ? quizTakers(state).length : 0,
    phase: quest.phase
  };
  return ok(stats);
}

function updateQuest(context: Context): Result {
  requireAdmin(context);

  const state = getState();
  const target = findQuestById(state, context.params.id ?? '');
  if (!target) throw new MockError(404, 'not_found', 'No such quest.');

  const parsed = updateQuestSchema.safeParse(context.body);
  if (!parsed.success) throw validationError(parsed.error.issues);

  const patch = parsed.data;
  const merged: Quest = {
    ...target,
    book: { ...target.book, ...defined(patch.book) },
    prizes: { ...target.prizes, ...defined(patch.prizes) },
    ...isoDates(patch),
    ...(patch.quizQuestionCount === undefined
      ? {}
      : { quizQuestionCount: patch.quizQuestionCount }),
    ...(patch.quizDurationMinutes === undefined
      ? {}
      : { quizDurationMinutes: patch.quizDurationMinutes })
  };

  // Ordering is checked against the merged result, not the patch — half an
  // edit is always in some order or other.
  const issues = findQuestDateIssues(toDates(merged));
  if (issues) {
    throw new MockError(
      400,
      'validation_failed',
      Object.values(issues)[0] ?? 'Those dates do not line up.',
      issues
    );
  }

  updateState((draft) => {
    if (draft.quest.id === merged.id) draft.quest = merged;
    else {
      draft.archive = draft.archive.map((entry) =>
        entry.quest.id === merged.id ? { ...entry, quest: merged } : entry
      );
    }
  });

  return ok(readQuest(merged, countFor(getState(), merged)));
}

function createQuest(context: Context): Result {
  requireAdmin(context);

  const parsed = createQuestSchema.safeParse(context.body);
  if (!parsed.success) throw validationError(parsed.error.issues);

  const input = parsed.data;
  const quest: Quest = {
    id: objectId(`quest:new:${input.edition}`),
    edition: input.edition,
    year: input.year,
    phase: 'upcoming',
    book: input.book,
    prizes: {
      first: input.prizes?.first ?? null,
      second: input.prizes?.second ?? null,
      third: input.prizes?.third ?? null
    },
    opensAt: input.opensAt.toISOString(),
    readingDeadline: input.readingDeadline.toISOString(),
    quizOpensAt: input.quizOpensAt.toISOString(),
    quizClosesAt: input.quizClosesAt.toISOString(),
    resultsAt: input.resultsAt.toISOString(),
    quizQuestionCount: input.quizQuestionCount,
    quizDurationMinutes: input.quizDurationMinutes,
    participantCount: 0
  };

  const issues = findQuestDateIssues(toDates(quest));
  if (issues) {
    throw new MockError(
      400,
      'validation_failed',
      Object.values(issues)[0] ?? 'Those dates do not line up.',
      issues
    );
  }

  updateState((draft) => {
    draft.archive = [{ quest, winner: null }, ...draft.archive];
  });

  return created({ ...quest, phase: resolvePhase(quest) } satisfies Quest);
}

/**
 * Swapping the current quest sends the roster with the edition it belongs to,
 * so the incoming one starts empty — which is what a new edition is.
 * `mockApi.reset()` puts the fixtures back.
 */
function makeQuestCurrent(context: Context): Result {
  requireAdmin(context);

  const state = getState();
  const id = context.params.id ?? '';
  const target = findQuestById(state, id);
  if (!target) throw new MockError(404, 'not_found', 'No such quest.');

  if (state.questRunning && state.quest.id === target.id) {
    return ok(readQuest(target, state.participants.length));
  }

  updateState((draft) => {
    const outgoing = draft.quest;
    draft.archive = [
      // Only a quest that was actually current has just left the stage.
      ...(draft.questRunning ? [{ quest: outgoing, winner: null }] : []),
      ...draft.archive.filter(
        (entry) => entry.quest.id !== target.id && entry.quest.id !== outgoing.id
      )
    ];
    draft.quest = target;
    draft.participants = draft.participants.filter((entry) => entry.questId === target.id);
    draft.myParticipantId = null;
    draft.questRunning = true;
  });

  return ok(readQuest(target, countFor(getState(), target)));
}

/* ── Table ───────────────────────────────────────────────────────────────── */

/** Literal paths sit above their `:param` neighbours — first match wins. */
const routes: Route[] = [
  { method: 'POST', path: '/auth/telegram', handle: login },
  { method: 'GET', path: '/auth/me', handle: (context) => ok(requireUser(context)) },

  { method: 'GET', path: '/quests', handle: listQuests },
  { method: 'GET', path: '/quests/current', handle: () => ok(requireCurrentQuest()) },
  {
    method: 'GET',
    path: '/quests/current/results',
    handle: () => {
      const quest = requireCurrentQuest();
      requirePublishedResults(quest);
      return ok(buildResults(quizTakers(getState()), quest));
    }
  },
  { method: 'GET', path: '/quests/:edition', handle: getQuestByEdition },

  { method: 'POST', path: '/participants', handle: register },
  { method: 'GET', path: '/participants/me', handle: myParticipant },
  { method: 'GET', path: '/participants/me/certificate', handle: myCertificate },
  { method: 'GET', path: '/participants/:number', handle: participantByNumber },

  { method: 'GET', path: '/admin/participants', handle: adminParticipants },
  { method: 'GET', path: '/admin/stats', handle: adminStats },
  { method: 'POST', path: '/admin/quests', handle: createQuest },
  { method: 'POST', path: '/admin/quests/:id/make-current', handle: makeQuestCurrent },
  { method: 'PATCH', path: '/admin/quests/:id', handle: updateQuest }
];

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  token: string | null;
}

export interface MockOutcome {
  status: number;
  payload: ApiResponse<unknown>;
}

export function handleRequest(request: MockRequest): MockOutcome {
  const match = matchRoute(request.method, request.path);

  try {
    if (!match) {
      throw new MockError(404, 'not_found', `No route for ${request.method} ${request.path}`);
    }

    const result = match.route.handle({
      params: match.params,
      query: request.query,
      body: request.body,
      token: request.token
    });

    return { status: result.status, payload: { ok: true, data: result.data } };
  } catch (error) {
    const failure =
      error instanceof MockError
        ? error
        : new MockError(500, 'internal_error', 'The mock threw. Check the console.');

    if (!(error instanceof MockError)) console.error('[mock] handler failed', error);

    return {
      status: failure.status,
      payload: {
        ok: false,
        error: {
          code: failure.code,
          message: failure.message,
          ...(failure.fields ? { fields: failure.fields } : {})
        }
      }
    };
  }
}

function matchRoute(
  method: string,
  path: string
): { route: Route; params: Record<string, string> } | null {
  const parts = path.split('/').filter(Boolean);

  for (const route of routes) {
    if (route.method !== method) continue;

    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== parts.length) continue;

    const params: Record<string, string> = {};
    const matched = pattern.every((segment, index) => {
      const value = parts[index] ?? '';
      if (!segment.startsWith(':')) return segment === value;
      params[segment.slice(1)] = decodeURIComponent(value);
      return true;
    });

    if (matched) return { route, params };
  }

  return null;
}

/* ── Small helpers ───────────────────────────────────────────────────────── */

/**
 * Who has a result. The first twenty of the roster, plus you once you have
 * registered — so a certificate is reachable after `mockApi.publishResults()`
 * rather than only ever belonging to a fixture.
 */
function quizTakers(state: MockState): Participant[] {
  const takers = state.participants.slice(0, 20);
  const mine = state.participants.find((entry) => entry.id === state.myParticipantId);
  return mine && !takers.includes(mine) ? [...takers, mine] : takers;
}

/** zod hands back only the keys that were sent, but a stray `undefined` in a
    spread would erase a field it never meant to touch. */
function defined<T extends object>(value: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

function readInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (raw === null || !Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function findQuestById(state: MockState, id: string): Quest | null {
  if (state.quest.id === id) return state.quest;
  return state.archive.find((entry) => entry.quest.id === id)?.quest ?? null;
}

const countFor = (state: MockState, quest: Quest): number =>
  state.participants.filter((entry) => entry.questId === quest.id).length;

/** The admin schema hands back Date objects; the wire format is ISO strings. */
function isoDates(patch: {
  opensAt?: Date;
  readingDeadline?: Date;
  quizOpensAt?: Date;
  quizClosesAt?: Date;
  resultsAt?: Date;
}): Partial<Record<keyof QuestDates, string>> {
  const out: Partial<Record<keyof QuestDates, string>> = {};
  if (patch.opensAt) out.opensAt = patch.opensAt.toISOString();
  if (patch.readingDeadline) out.readingDeadline = patch.readingDeadline.toISOString();
  if (patch.quizOpensAt) out.quizOpensAt = patch.quizOpensAt.toISOString();
  if (patch.quizClosesAt) out.quizClosesAt = patch.quizClosesAt.toISOString();
  if (patch.resultsAt) out.resultsAt = patch.resultsAt.toISOString();
  return out;
}

const toDates = (quest: Quest): QuestDates => ({
  opensAt: new Date(quest.opensAt),
  readingDeadline: new Date(quest.readingDeadline),
  quizOpensAt: new Date(quest.quizOpensAt),
  quizClosesAt: new Date(quest.quizClosesAt),
  resultsAt: new Date(quest.resultsAt)
});
