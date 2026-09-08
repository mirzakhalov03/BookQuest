import type { AdminStats, Paginated, Participant } from '@bookquest/shared';
import { ParticipantModel } from '../models/participant.model.js';
import { ResultModel } from '../models/result.model.js';
import { QuestModel } from '../models/quest.model.js';
import { ApiError } from '../utils/api-error.js';
import { requireCurrentQuestDocument, resolvePhase } from './quest.services.js';
import { toParticipantDto } from './participant.services.js';

export interface ParticipantQuery {
  q?: string | undefined;
  questId?: string | undefined;
  page: number;
  limit: number;
}

/**
 * The admin roster. Includes contact — reaching people is the entire reason an
 * organiser opens this screen — which is exactly why the route is behind
 * requireAdmin and the public participant view is not this shape.
 */
export async function listParticipants(query: ParticipantQuery): Promise<Paginated<Participant>> {
  const quest = query.questId
    ? await QuestModel.findById(query.questId)
    : await requireCurrentQuestDocument();

  if (!quest) throw ApiError.notFound('No such quest.');

  const filter: Record<string, unknown> = { quest: quest._id };
  const term = query.q?.trim();

  if (term) {
    const asNumber = Number(term);
    filter.$or = [
      { fullName: { $regex: escapeRegex(term), $options: 'i' } },
      ...(Number.isInteger(asNumber) ? [{ number: asNumber }] : [])
    ];
  }

  const [participants, total] = await Promise.all([
    ParticipantModel.find(filter)
      .sort({ number: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    ParticipantModel.countDocuments(filter)
  ]);

  return {
    items: participants.map(toParticipantDto),
    page: query.page,
    limit: query.limit,
    total
  };
}

export async function getStats(): Promise<AdminStats> {
  const quest = await requireCurrentQuestDocument();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [participants, registeredToday, quizSubmitted] = await Promise.all([
    ParticipantModel.countDocuments({ quest: quest._id }),
    ParticipantModel.countDocuments({ quest: quest._id, createdAt: { $gte: startOfToday } }),
    ResultModel.countDocuments({ quest: quest._id })
  ]);

  return { participants, registeredToday, quizSubmitted, phase: resolvePhase(quest) };
}

/** A name is user input; a regex built from user input is an outage. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
