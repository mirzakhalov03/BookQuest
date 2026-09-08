import type { Participant, ParticipantPublic, RegisterParticipantPayload } from '@bookquest/shared';
import { PARTICIPANT_NUMBER_MAX, PARTICIPANT_NUMBER_MIN } from '@bookquest/shared';
import { ParticipantModel, type ParticipantDocument } from '../models/participant.model.js';
import { QuestModel, type QuestDocument } from '../models/quest.model.js';
import { nextSequence } from '../models/counter.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { isDuplicateKeyError } from '../utils/mongo.js';
import { findCurrentQuestDocument, requireCurrentQuestDocument } from './quest.services.js';

/**
 * Registration closes when the reading period ends — the same promise the
 * prototype's copy makes. Registering after that would hand someone a number
 * for a quiz they cannot reach.
 */
export function isRegistrationOpen(quest: QuestDocument, now = new Date()): boolean {
  return now < quest.readingDeadline;
}

export async function registerParticipant(
  user: UserDocument,
  payload: RegisterParticipantPayload
): Promise<Participant> {
  const quest = await requireCurrentQuestDocument();

  if (!isRegistrationOpen(quest)) {
    throw ApiError.conflict('Registration for this year has closed.');
  }

  const already = await ParticipantModel.findOne({ quest: quest._id, user: user._id });
  if (already) {
    throw ApiError.conflict(`You are already registered as participant ${already.number}.`);
  }

  /* Allocated before the insert and never returned to the pool. A gap in the
     sequence is harmless; handing the same number to two people is not. */
  const number = await nextSequence(`participant:${quest.id}`, PARTICIPANT_NUMBER_MIN);
  if (number > PARTICIPANT_NUMBER_MAX) {
    throw ApiError.conflict('This year’s quest is full.');
  }

  let participant: ParticipantDocument;
  try {
    participant = await ParticipantModel.create({
      number,
      fullName: payload.fullName,
      contact: payload.contact,
      quest: quest._id,
      user: user._id
    });
  } catch (error) {
    /* The findOne above is a courtesy; this is the guarantee. Two requests can
       both pass the check, and only the unique index decides which one wins. */
    if (isDuplicateKeyError(error)) {
      const existing = await ParticipantModel.findOne({ quest: quest._id, user: user._id });
      throw ApiError.conflict(
        existing
          ? `You are already registered as participant ${existing.number}.`
          : 'That registration already exists.'
      );
    }
    throw error;
  }

  await QuestModel.updateOne({ _id: quest._id }, { $inc: { participantCount: 1 } });

  return toParticipantDto(participant);
}

/** Someone else's participant, for a session holder. Never includes contact. */
export async function getParticipantByNumber(number: number): Promise<ParticipantPublic> {
  const quest = await requireCurrentQuestDocument();
  const participant = await ParticipantModel.findOne({ quest: quest._id, number });

  if (!participant) throw ApiError.notFound(`No participant ${number} in this quest.`);
  return toParticipantPublicDto(participant);
}

/** Null when there is no current quest, or the caller has not registered for it. */
export async function findParticipantForUser(user: UserDocument): Promise<Participant | null> {
  const quest = await findCurrentQuestDocument();
  if (!quest) return null;

  const participant = await ParticipantModel.findOne({ quest: quest._id, user: user._id });
  return participant ? toParticipantDto(participant) : null;
}

export async function requireParticipantForUser(user: UserDocument): Promise<Participant> {
  const participant = await findParticipantForUser(user);
  if (!participant) throw ApiError.notFound('You have not registered for this quest yet.');
  return participant;
}

export function toParticipantDto(participant: ParticipantDocument): Participant {
  return {
    id: participant.id,
    number: participant.number,
    fullName: participant.fullName,
    contact: {
      method: participant.contact.method,
      value: participant.contact.value
    },
    questId: String(participant.quest),
    registeredAt: participant.createdAt.toISOString()
  };
}

export function toParticipantPublicDto(participant: ParticipantDocument): ParticipantPublic {
  return { number: participant.number, fullName: participant.fullName };
}
