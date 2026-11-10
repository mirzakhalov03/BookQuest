import { z } from 'zod';
import {
  CONTACT_METHODS,
  INTERACTION_KINDS,
  createQuestSchema,
  updateQuestSchema,
  createBroadcastSchema
} from '@bookquest/shared';
import { objectId } from './common.js';
import { decodeCursor } from '../utils/cursor.js';

export const questIdParams = z.object({ id: objectId });

export const adminParticipantQuery = z.object({
  /** Matched against name, number or contact. */
  q: z.string().trim().max(80).optional(),
  questId: objectId.optional(),
  contactMethod: z.enum(CONTACT_METHODS).optional(),
  sort: z.enum(['number', 'name', 'registered']).default('number'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50)
});

export const createQuestBody = createQuestSchema;
export const updateQuestBody = updateQuestSchema;
export const createBroadcastBody = createBroadcastSchema;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-09.');
const flag = z.enum(['true', 'false']).transform((value) => value === 'true');
const cursorParam = z
  .string()
  .max(200)
  .transform((raw, ctx) => {
    const cursor = decodeCursor(raw);
    if (!cursor) {
      ctx.addIssue({ code: 'custom', message: 'That list position is no longer valid. Reload the page.' });
      return z.NEVER;
    }
    return cursor;
  });
const kinds = z
  .string()
  .max(200)
  .transform((raw) =>
    raw
      .split(',')
      .map((kind) => kind.trim())
      .filter(Boolean)
  )
  .pipe(z.array(z.enum(INTERACTION_KINDS, 'Unknown kind.')));

export const adminInteractionQuery = z.object({
  view: z.enum(['messages', 'all']).default('messages'),
  kind: kinds.optional(),
  person: z.string().regex(/^\d{1,20}$/, 'That is not a Telegram id.').optional(),
  /** Matched against text, button labels, names and @handles; digits also match the Telegram id. */
  q: z.string().trim().max(80).optional(),
  command: z.string().trim().toLowerCase().max(64).optional(),
  broadcast: objectId.optional(),
  hasContact: flag.optional(),
  includeAdmins: flag.default(false),
  from: day.optional(),
  to: day.optional(),
  order: z.enum(['newest', 'oldest']).default('newest'),
  cursor: cursorParam.optional(),
  /** Rows newer than this cursor — the "N new" poll. */
  since: cursorParam.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
export type AdminInteractionQuery = z.output<typeof adminInteractionQuery>;

export const adminInteractionFacetsQuery = z.object({
  from: day.optional(),
  to: day.optional(),
  includeAdmins: flag.default(false)
});
export type AdminInteractionFacetsQuery = z.output<typeof adminInteractionFacetsQuery>;
