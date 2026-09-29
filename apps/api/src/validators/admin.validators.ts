import { z } from 'zod';
import { createQuestSchema, updateQuestSchema, createBroadcastSchema } from '@bookquest/shared';
import { OBJECT_ID_PATTERN } from '../utils/mongo.js';

const objectId = z.string().regex(OBJECT_ID_PATTERN, 'That is not a valid id.');

export const questIdParams = z.object({ id: objectId });

export const adminParticipantQuery = z.object({
  /** Matched against name, number or contact. */
  q: z.string().trim().max(80).optional(),
  questId: objectId.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50)
});

export const createQuestBody = createQuestSchema;
export const updateQuestBody = updateQuestSchema;
export const createBroadcastBody = createBroadcastSchema;
