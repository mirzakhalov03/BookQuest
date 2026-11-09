import type { Types } from 'mongoose';
import { ParticipantModel } from '../models/participant.model.js';

export interface ParticipantName {
  number: number;
  fullName: string;
}

/** Names for a set of result rows in one query, keyed by participant id. Own module so quest and result services can share it without a cycle. */
export async function participantsById(ids: Types.ObjectId[]): Promise<Map<string, ParticipantName>> {
  if (ids.length === 0) return new Map();
  const participants = await ParticipantModel.find({ _id: { $in: ids } })
    .select('number fullName')
    .lean();
  return new Map(
    participants.map((participant) => [
      String(participant._id),
      { number: participant.number, fullName: participant.fullName }
    ])
  );
}
