import type { Types } from 'mongoose';
import type { Participant, ParticipantPublic, RegisterParticipantPayload } from '@bookquest/shared';
import { PARTICIPANT_NUMBER_MAX, PARTICIPANT_NUMBER_MIN } from '@bookquest/shared';
import { ParticipantModel, type ParticipantDocument, type ParticipantRow } from '../models/participant.model.js';
import { QuestModel, type QuestDocument } from '../models/quest.model.js';
import { nextSequence } from '../models/counter.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { isDuplicateKeyError } from '../utils/mongo.js';
import { findCurrentQuestDocument, requireCurrentQuestDocument } from './quest.services.js';
import { announceRegistration } from './registration-alerts.services.js';
import { findTelegramOwnerOfContact } from './duplicate-guard.services.js';
import { maskUsername } from '../utils/mask.js';
import { escapeRegex } from '../utils/regex.js';

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
    throw ApiError.conflict('Registration for this year has closed.', { reason: 'registration_closed' });
  }

  const already = await ParticipantModel.findOne({ quest: quest._id, user: user._id });
  if (already) {
    throw ApiError.conflict(`You are already registered as participant ${already.number}.`, {
      reason: 'already_registered'
    });
  }

  if (!payload.confirmNotDuplicate) {
    const owner = await findTelegramOwnerOfContact(quest._id, payload.contact, user._id);
    if (owner) {
      throw ApiError.conflict(`${maskUsername(owner.username)} has already joined in Telegram.`, {
        reason: 'already_registered_elsewhere'
      });
    }
  }

  /* Allocated before the insert and never returned to the pool. A gap in the
     sequence is harmless; handing the same number to two people is not. */
  const number = await nextSequence(`participant:${quest.id}`, PARTICIPANT_NUMBER_MIN);
  if (number > PARTICIPANT_NUMBER_MAX) {
    throw ApiError.conflict('This year’s quest is full.', { reason: 'quest_full' });
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
          : 'That registration already exists.',
        { reason: 'already_registered' }
      );
    }
    throw error;
  }

  await QuestModel.updateOne({ _id: quest._id }, { $inc: { participantCount: 1 } });

  // Not awaited: a slow Telegram must not hold up the participant's confirmation.
  void announceRegistration(participant);

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
export async function findParticipantForUser(
  user: UserDocument,
  // Pass it when the caller already loaded it, to skip a second read.
  currentQuest?: QuestDocument | null
): Promise<Participant | null> {
  const quest = currentQuest === undefined ? await findCurrentQuestDocument() : currentQuest;
  if (!quest) return null;

  const participant = await ParticipantModel.findOne({ quest: quest._id, user: user._id });
  return participant ? toParticipantDto(participant) : null;
}

export async function requireParticipantForUser(
  user: UserDocument,
  currentQuest?: QuestDocument
): Promise<Participant> {
  const participant = await findParticipantForUser(user, currentQuest);
  if (!participant) throw ApiError.notFound('You have not registered for this quest yet.', { reason: 'not_registered' });
  return participant;
}

export function toParticipantDto(participant: ParticipantRow): Participant {
  return {
    id: String(participant._id),
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

/** The roster's view: adds what only organisers need. */
export function toAdminParticipantDto(participant: ParticipantRow): Participant {
  const previous = participant.previousContacts ?? [];
  return { ...toParticipantDto(participant), ...(previous.length > 0 && { previousContacts: previous.map((c) => c.value) }) };
}

export function toParticipantPublicDto(participant: ParticipantRow): ParticipantPublic {
  return { number: participant.number, fullName: participant.fullName };
}

/**
 * Telegram registrations always show the reader's current handle; whatever it replaced moves
 * to `previousContacts`, so nothing is lost. No handle on the account: leave the record alone.
 */
export async function syncTelegramContact(userId: Types.ObjectId, username: string | null | undefined): Promise<void> {
  if (!username) return;
  const current = `@${username}`;
  const stale = await ParticipantModel.find({
    user: userId,
    'contact.method': 'telegram',
    // Telegram handles are case-insensitive, so a case-only difference isn't a change.
    'contact.value': { $not: new RegExp(`^${escapeRegex(current)}$`, 'i') }
  });

  const replacedAt = new Date();
  for (const participant of stale) {
    participant.previousContacts.push({ value: participant.contact.value, replacedAt });
    participant.contact.value = current;
    await participant.save();
  }
}
