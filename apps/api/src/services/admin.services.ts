import type { Types } from 'mongoose';
import type { AdminStats, ContactMethod, Paginated, Participant } from '@bookquest/shared';
import { ParticipantModel, type ParticipantRow } from '../models/participant.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { ResultModel } from '../models/result.model.js';
import { QuestModel } from '../models/quest.model.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';
import { escapeRegex } from '../utils/regex.js';
import { startOfDayIn } from '../utils/time-zone.js';
import { requireCurrentQuestDocument, resolvePhase } from './quest.services.js';
import { toParticipantDto } from './participant.services.js';

const SORT_FIELDS = { number: 'number', name: 'fullName', registered: 'createdAt' } as const;

/** `number` is unique per quest, so as the tiebreaker it keeps pages stable when names or dates collide. */
function sortSpec({ sort, order }: Pick<ParticipantQuery, 'sort' | 'order'>): Record<string, 1 | -1> {
  const direction = order === 'asc' ? 1 : -1;
  return sort === 'number' ? { number: direction } : { [SORT_FIELDS[sort]]: direction, number: 1 };
}

export interface ParticipantQuery {
  q?: string | undefined;
  questId?: string | undefined;
  contactMethod?: ContactMethod | undefined;
  sort: 'number' | 'name' | 'registered';
  order: 'asc' | 'desc';
  page: number;
  limit: number;
}

/**
 * The admin roster. Includes contact — reaching people is the entire reason an
 * organiser opens this screen — which is exactly why the route is behind
 * requireAdmin and the public participant view is not this shape.
 */
const normalise = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Ids on this page that share a name and contact with another entry in the quest — how a double sign-up looks. */
async function findPossibleDuplicates(questId: Types.ObjectId, page: ParticipantRow[]): Promise<Set<string>> {
  if (page.length === 0) return new Set();
  const twins = await ParticipantModel.find(
    { quest: questId, 'contact.value': { $in: page.map((row) => row.contact.value) } },
    '_id fullName contact'
  )
    .collation({ locale: 'en', strength: 2 })
    .lean();
  const key = (row: { fullName: string; contact: { value: string } }) =>
    `${normalise(row.fullName)}|${normalise(row.contact.value)}`;
  const counts = new Map<string, number>();
  for (const row of twins) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return new Set(page.filter((row) => (counts.get(key(row)) ?? 0) > 1).map((row) => String(row._id)));
}

export async function listParticipants(query: ParticipantQuery): Promise<Paginated<Participant>> {
  const quest = query.questId
    ? await QuestModel.findById(query.questId)
    : await requireCurrentQuestDocument();

  if (!quest) throw ApiError.notFound('No such quest.');

  const filter: Record<string, unknown> = { quest: quest._id };
  const term = query.q?.trim();

  if (query.contactMethod) filter['contact.method'] = query.contactMethod;

  if (term) {
    const asNumber = Number(term);
    const digits = term.replace(/\D/g, '');
    filter.$or = [
      { fullName: { $regex: escapeRegex(term), $options: 'i' } },
      { 'contact.value': { $regex: escapeRegex(term), $options: 'i' } },
      // Phones are stored grouped ("+998 90 123 45 67"); let any separators sit between typed digits. Digits need no escaping.
      ...(digits.length >= 4 ? [{ 'contact.value': { $regex: digits.split('').join('\\D*'), $options: 'i' } }] : []),
      ...(Number.isInteger(asNumber) ? [{ number: asNumber }] : [])
    ];
  }

  const [participants, total] = await Promise.all([
    ParticipantModel.find(filter)
      .sort(sortSpec(query))
      .collation({ locale: 'en', strength: 2 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<ParticipantRow[]>(),
    ParticipantModel.countDocuments(filter)
  ]);

  const duplicates = await findPossibleDuplicates(quest._id, participants);
  return {
    items: participants.map((row) => ({ ...toParticipantDto(row), possibleDuplicate: duplicates.has(String(row._id)) })),
    page: query.page,
    limit: query.limit,
    total
  };
}

export async function getStats(): Promise<AdminStats> {
  const quest = await requireCurrentQuestDocument();

  const startOfToday = startOfDayIn(env.ORGANISER_TIME_ZONE);

  const [participants, registeredToday, quizSubmitted, quizInProgress] = await Promise.all([
    ParticipantModel.countDocuments({ quest: quest._id }),
    ParticipantModel.countDocuments({ quest: quest._id, createdAt: { $gte: startOfToday } }),
    ResultModel.countDocuments({ quest: quest._id }),
    QuizAttemptModel.countDocuments({ quest: quest._id, status: 'in_progress' })
  ]);

  return { participants, registeredToday, quizSubmitted, quizInProgress, phase: resolvePhase(quest) };
}
