import type { Request, Response } from 'express';
import type { BotInteractionsBatch, BotUserUpsertPayload } from '@bookquest/shared';
import * as userService from '../services/user.services.js';
import * as interactionService from '../services/interaction.services.js';
import { ok } from '../utils/respond.js';

/** POST /api/v1/bot/users — called only by apps/bot, never by a browser. */
export async function upsertUser(req: Request, res: Response): Promise<void> {
  const profile = req.body as BotUserUpsertPayload;
  const user = await userService.upsertUserFromTelegramProfile(profile);
  ok(res, { id: user.id });
}

/** POST /api/v1/bot/interactions — apps/bot's batched log. 202: stored, nothing to return. */
export async function recordInteractions(req: Request, res: Response): Promise<void> {
  const { items } = req.body as BotInteractionsBatch;
  ok(res, { accepted: await interactionService.recordInteractions(items) }, 202);
}
