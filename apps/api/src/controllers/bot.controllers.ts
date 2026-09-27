import type { Request, Response } from 'express';
import type { BotUserUpsertPayload } from '@bookquest/shared';
import * as userService from '../services/user.services.js';
import { ok } from '../utils/respond.js';

/** POST /api/v1/bot/users — called only by apps/bot, never by a browser. */
export async function upsertUser(req: Request, res: Response): Promise<void> {
  const profile = req.body as BotUserUpsertPayload;
  const user = await userService.upsertUserFromTelegramProfile(profile);
  ok(res, { id: user.id });
}
