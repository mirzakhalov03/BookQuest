import {
  COVER_MESSAGES,
  normalizeCertificateCode,
  PARTICIPANT_NUMBER_MAX,
  createBroadcastSchema,
  createQuestSchema,
  createQuizSchema,
  findQuestDateIssues,
  groupLabels,
  registerParticipantSchema,
  saveQuizSchema,
  updateProfileSchema,
  updateQuestSchema
} from '@bookquest/shared';
import type {
  AdminQuest,
  AdminStats,
  ApiErrorCode,
  ApiResponse,
  Broadcast,
  BroadcastList,
  CursorPage,
  Paginated,
  Participant,
  ParticipantPublic,
  Quest,
  QuestDates,
  QuestSummary,
  Session,
  SessionUser,
  UpdateQuestPayload
} from '@bookquest/shared';
import { objectId, questSummary } from './fixtures';
import { listMockInteractions, mockInteractionFacets } from './interactions';
import { buildCertificate, buildResults } from './people';
import * as quizzes from './quiz';
import * as play from './quiz-participant';
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
  readonly reason: string | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    fields?: Record<string, string>,
    reason?: string
  ) {
    super(message);
    this.name = 'MockError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.reason = reason;
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
    throw new MockError(401, 'unauthorized', 'Sign in to continue.');
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

function updateMe(context: Context): Result {
  requireUser(context);
  const parsed = updateProfileSchema.safeParse(context.body);
  if (!parsed.success) throw validationError(parsed.error.issues);

  const next = updateState((draft) => {
    draft.user = { ...draft.user, avatar: parsed.data.avatar };
  });
  return ok(readUser(next));
}

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

  return ok(buildCertificate(user.participant, quest, entry.rank, leaderboard.length));
}

/** Public, like the API: holding the code is the permission. */
function certificateByCode(context: Context): Result {
  const quest = requireCurrentQuest();
  requirePublishedResults(quest);
  const code = normalizeCertificateCode(context.params.code ?? '');
  const { leaderboard } = buildResults(quizTakers(getState()), quest);
  for (const entry of leaderboard) {
    const participant = getState().participants.find((row) => row.number === entry.number);
    if (!participant) continue;
    const data = buildCertificate(participant, quest, entry.rank, leaderboard.length);
    if (data.code === code) return ok(data);
  }
  throw new MockError(404, 'not_found', 'We couldn’t find a certificate with this code.');
}

/** A delivery that finishes instantly: about four in five finishers "have Telegram". */
function certificateDelivery(context: Context): Result {
  requireAdmin(context);
  const total = quizTakers(getState()).length;
  const reachable = Math.round(total * 0.8);
  const sent = getState().certificatesSent === true;
  const at = sent ? getState().quest.resultsAt : null;
  return ok({
    status: sent ? 'sent' : 'idle',
    total,
    delivered: sent ? reachable : 0,
    inAppOnly: sent ? total - reachable : 0,
    blocked: 0,
    failed: 0,
    pending: sent ? 0 : total,
    pendingReachable: sent ? 0 : reachable,
    startedAt: at,
    completedAt: at
  });
}

function sendCertificates(context: Context): Result {
  requireAdmin(context);
  requirePublishedResults(requireCurrentQuest());
  if (getState().certificatesSent) throw new MockError(409, 'conflict', 'Certificates are already being sent.');
  updateState((draft) => {
    draft.certificatesSent = true;
  });
  return certificateDelivery(context);
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
  // Phones are stored grouped ("+998 90 123 45 67"); compare bare digits so "901234" still matches.
  const digits = term.replace(/\D/g, '');
  const page = readInt(context.query.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = readInt(context.query.get('limit'), 50, 1, 200);

  const all = [...getState().participants].sort((a, b) => a.number - b.number);
  const matches = term
    ? all.filter(
        (entry) =>
          entry.fullName.toLowerCase().includes(term) ||
          entry.contact.value.toLowerCase().includes(term) ||
          (digits.length >= 4 && entry.contact.value.replace(/\D/g, '').includes(digits)) ||
          String(entry.number) === term
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
  const isCurrent = target.id === state.quest.id;
  const config = patch.quizConfig === undefined || !isCurrent ? undefined : mockQuizConfig(patch.quizConfig);
  const merged: Quest = {
    ...target,
    book: { ...target.book, ...defined(patch.book) },
    prizes: { ...target.prizes, ...defined(patch.prizes) },
    ...isoDates(patch),
    ...(config === undefined ? {} : { quiz: config.quiz })
  };

  // Ordering is checked against the merged result, not the patch — half an
  // edit is always in some order or other.
  // The API only demands the results buffer when the edit moves those dates.
  const issues = findQuestDateIssues(toDates(merged), {
    requireResultsBuffer: patch.quizClosesAt !== undefined || patch.resultsAt !== undefined
  });
  if (issues) {
    throw new MockError(
      400,
      'validation_failed',
      Object.values(issues)[0] ?? 'Those dates do not line up.',
      issues
    );
  }

  updateState((draft) => {
    if (config !== undefined) draft.quizConfig = config.quizConfig;
    if (draft.quest.id === merged.id) draft.quest = merged;
    else {
      draft.archive = draft.archive.map((entry) =>
        entry.quest.id === merged.id ? { ...entry, quest: merged } : entry
      );
    }
  });

  return ok(toAdminQuest(readQuest(merged, countFor(getState(), merged))));
}

/** Roster split by the same rule as the API; a random split has no seed to preview. */
function groupSizes(context: Context): Result {
  requireAdmin(context);
  const distribution = context.query.get('distribution');
  const { participants } = getState();
  if (distribution === 'single') return ok({ sizes: [participants.length] });
  if (distribution === 'parity') {
    const odd = participants.filter((entry) => entry.number % 2 === 1).length;
    return ok({ sizes: [odd, participants.length - odd] });
  }
  return ok({ sizes: null });
}

/** Stores the setup without the API's readiness and shape rules; the summary follows the first quiz. */
function mockQuizConfig(input: UpdateQuestPayload['quizConfig']): {
  quizConfig: AdminQuest['quizConfig'];
  quiz: Quest['quiz'];
} {
  if (!input) return { quizConfig: null, quiz: null };
  const first = quizzes.listQuizzes().find((quiz) => quiz.id === input.quizIds[0]);
  if (!first) throw new MockError(400, 'validation_failed', 'One of those quizzes no longer exists.', { quizConfig: 'One of those quizzes no longer exists.' });
  return {
    quizConfig: { ...input, groupLabels: groupLabels(input.distribution, input.quizIds.length) },
    quiz: { questionCount: first.questionCount, totalSeconds: first.totalSeconds }
  };
}

const toAdminQuest = (quest: Quest): AdminQuest => ({
  ...quest,
  quizConfig: quest.id === getState().quest.id ? (getState().quizConfig ?? null) : null
});

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
    quiz: null,
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

  // Mirrors the API: results live only on the current quest, so it can't be archived before they're out.
  const { quest: outgoing, questRunning } = getState();
  if (input.makeCurrent && questRunning && !areResultsPublished(outgoing)) {
    throw new MockError(409, 'conflict', `Results for edition ${outgoing.edition} are not out yet.`);
  }

  updateState((draft) => {
    draft.archive = [{ quest, winner: null }, ...draft.archive];
  });

  if (input.makeCurrent) {
    switchCurrent(quest);
    return created(readQuest(quest, 0));
  }

  return created({ ...quest, phase: resolvePhase(quest) } satisfies Quest);
}

/** Swaps the current edition; the outgoing one joins the archive and the roster follows its edition. */
function switchCurrent(target: Quest): void {
  updateState((draft) => {
    const outgoing = draft.quest;
    draft.archive = [
      // Only a quest that was actually current has just left the stage.
      ...(draft.questRunning ? [{ quest: outgoing, winner: null }] : []),
      ...draft.archive.filter((entry) => entry.quest.id !== target.id && entry.quest.id !== outgoing.id)
    ];
    draft.quest = target;
    draft.participants = draft.participants.filter((entry) => entry.questId === target.id);
    draft.myParticipantId = null;
    draft.questRunning = true;
    // Quizzes are book-specific; a new edition starts unconfigured.
    draft.quizConfig = null;
    draft.quizAttempt = null;
  });
}

/** A session-lived blob URL stands in for the GridFS URL — enough for the picker to work end to end. */
function uploadCover(context: Context): Result {
  requireAdmin(context);

  const file = context.body instanceof FormData ? context.body.get('file') : null;
  if (!(file instanceof File)) {
    throw new MockError(400, 'validation_failed', COVER_MESSAGES.missing, { file: COVER_MESSAGES.missing });
  }
  return created({ url: URL.createObjectURL(file) });
}

/* ── Broadcasts ──────────────────────────────────────────────────────────── */

/** Not in MockState: nothing else reads it, and a reload clearing the outbox is fine. */
let outbox: Array<{ broadcast: Broadcast; startedAt: number }> = [];
const MOCK_SEND_MS = 40;

function audience(): { audience: number; dmAudience: number } {
  const total = getState().participants.length + 12;
  return { audience: total, dmAudience: Math.round(total * 0.8) };
}

/** Progress is derived from elapsed time, so the screen's polling has something to watch. */
function progressed({ broadcast, startedAt }: (typeof outbox)[number]): Broadcast {
  const sentCount = Math.min(broadcast.dmCount, Math.floor((Date.now() - startedAt) / MOCK_SEND_MS));
  const done = sentCount === broadcast.dmCount;
  return {
    ...broadcast,
    sentCount,
    status: done ? 'sent' : 'sending',
    completedAt: done ? new Date(startedAt + broadcast.dmCount * MOCK_SEND_MS).toISOString() : null
  };
}

function listBroadcasts(context: Context): Result {
  requireAdmin(context);
  const list: BroadcastList = { items: outbox.slice(0, 20).map(progressed), ...audience() };
  return ok(list);
}

function sendBroadcast(context: Context): Result {
  requireAdmin(context);
  const parsed = createBroadcastSchema.safeParse(context.body);
  if (!parsed.success) throw validationError(parsed.error.issues);

  const { audience: recipientCount, dmAudience: dmCount } = audience();
  const broadcast: Broadcast = {
    id: objectId(`broadcast:${outbox.length}`),
    message: parsed.data.message,
    status: 'sending',
    recipientCount,
    dmCount,
    sentCount: 0,
    failedCount: 0,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  outbox = [{ broadcast, startedAt: Date.now() }, ...outbox];
  return { status: 202, data: broadcast };
}

/* ── Quizzes ─────────────────────────────────────────────────────────────── */

/** Translates quiz failures (library or play) into the mock's own error. */
function translateQuiz<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (!(error instanceof quizzes.QuizFailure)) throw error;
    throw new MockError(error.status, error.code, error.message, error.fields, error.reason);
  }
}

/** Runs a library call as an admin. */
function quizCall(context: Context, run: () => unknown, status = 200): Result {
  requireAdmin(context);
  return { status, data: translateQuiz(run) };
}

/** Runs a participant quiz call as the signed-in user. */
function playCall(context: Context, run: (user: SessionUser) => unknown): Result {
  const user = requireUser(context);
  return ok(translateQuiz(() => run(user)));
}

function startQuiz(context: Context): Result {
  const user = requireUser(context);
  const { state, created } = translateQuiz(() => play.startAttempt(user));
  return created ? { status: 201, data: state } : ok(state);
}

function parseBody<T>(schema: { safeParse: (body: unknown) => { success: true; data: T } | { success: false; error: { issues: readonly Issue[] } } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error.issues);
  return parsed.data;
}

const quizId = (context: Context) => context.params.id ?? '';

/* ── Table ───────────────────────────────────────────────────────────────── */

/** Literal paths sit above their `:param` neighbours — first match wins. */
const routes: Route[] = [
  { method: 'POST', path: '/auth/telegram', handle: login },
  { method: 'GET', path: '/auth/me', handle: (context) => ok(requireUser(context)) },
  { method: 'PATCH', path: '/auth/me', handle: updateMe },

  { method: 'GET', path: '/quests', handle: listQuests },
  { method: 'GET', path: '/quests/current', handle: () => ok(requireCurrentQuest()) },
  {
    method: 'GET',
    path: '/quests/current/results',
    handle: (context) => {
      const quest = requireCurrentQuest();
      requirePublishedResults(quest);
      // Same rule as the API: the full board only with a live session.
      const signedIn = context.token !== null && context.token === getState().token;
      return ok(buildResults(quizTakers(getState()), quest, signedIn));
    }
  },
  { method: 'GET', path: '/quests/:edition', handle: getQuestByEdition },

  { method: 'POST', path: '/participants', handle: register },
  { method: 'GET', path: '/participants/me', handle: myParticipant },
  { method: 'GET', path: '/participants/me/certificate', handle: myCertificate },
  { method: 'GET', path: '/participants/:number', handle: participantByNumber },

  { method: 'GET', path: '/certificates/:code', handle: certificateByCode },
  { method: 'GET', path: '/admin/certificates/delivery', handle: certificateDelivery },
  { method: 'POST', path: '/admin/certificates/send', handle: sendCertificates },

  { method: 'GET', path: '/admin/participants', handle: adminParticipants },
  {
    method: 'GET',
    path: '/admin/interactions/facets',
    handle: (context) => {
      requireAdmin(context);
      return ok(mockInteractionFacets(context.query));
    }
  },
  {
    method: 'GET',
    path: '/admin/interactions',
    handle: (context) => {
      requireAdmin(context);
      return ok(listMockInteractions(context.query));
    }
  },
  { method: 'GET', path: '/admin/stats', handle: adminStats },
  { method: 'GET', path: '/admin/broadcasts', handle: listBroadcasts },
  { method: 'POST', path: '/admin/broadcasts', handle: sendBroadcast },
  { method: 'POST', path: '/admin/covers', handle: uploadCover },
  { method: 'GET', path: '/quiz/me', handle: (c) => playCall(c, play.quizOverview) },
  { method: 'POST', path: '/quiz/attempt', handle: startQuiz },
  { method: 'GET', path: '/quiz/attempt', handle: (c) => playCall(c, play.getAttempt) },
  { method: 'POST', path: '/quiz/attempt/next', handle: (c) => playCall(c, play.nextQuestion) },
  {
    method: 'PUT',
    path: '/quiz/attempt/items/:index',
    handle: (c) => playCall(c, (user) => play.putItem(user, Number(c.params.index), c.body))
  },
  { method: 'GET', path: '/admin/quizzes', handle: (c) => quizCall(c, quizzes.listQuizzes) },
  {
    method: 'POST',
    path: '/admin/quizzes',
    handle: (c) => quizCall(c, () => quizzes.createQuiz(parseBody(createQuizSchema, c.body)), 201)
  },
  { method: 'GET', path: '/admin/quizzes/:id', handle: (c) => quizCall(c, () => quizzes.getQuiz(quizId(c))) },
  {
    method: 'PUT',
    path: '/admin/quizzes/:id',
    handle: (c) => quizCall(c, () => quizzes.saveQuiz(quizId(c), parseBody(saveQuizSchema, c.body)))
  },
  { method: 'DELETE', path: '/admin/quizzes/:id', handle: (c) => quizCall(c, () => quizzes.deleteQuiz(quizId(c)) ?? null) },
  {
    method: 'POST',
    path: '/admin/quizzes/:id/duplicate',
    handle: (c) => quizCall(c, () => quizzes.duplicateQuiz(quizId(c)), 201)
  },
  {
    method: 'GET',
    path: '/admin/quests/current',
    handle: (c) => {
      requireAdmin(c);
      return ok(toAdminQuest(requireCurrentQuest()));
    }
  },
  { method: 'GET', path: '/admin/quiz/group-sizes', handle: groupSizes },
  { method: 'POST', path: '/admin/quests', handle: createQuest },
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
          ...(failure.fields ? { fields: failure.fields } : {}),
          ...(failure.reason ? { reason: failure.reason } : {})
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
