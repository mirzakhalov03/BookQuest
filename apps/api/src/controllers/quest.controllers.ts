import type { Request, Response } from 'express';
import * as questService from '../services/quest.services.js';
import { ok } from '../utils/respond.js';

/** GET /api/v1/quests/current */
export async function getCurrentQuest(_req: Request, res: Response): Promise<void> {
  // Public, and identical for everyone. Half a minute of caching absorbs the
  // burst when a broadcast goes out without ever showing a stale countdown.
  res.setHeader('Cache-Control', 'public, max-age=30');
  ok(res, await questService.getCurrentQuest());
}

/** GET /api/v1/quests */
export async function listQuests(req: Request, res: Response): Promise<void> {
  const { limit, cursor } = req.query as unknown as { limit: number; cursor?: string };
  ok(res, await questService.listPastQuests({ limit, cursor }));
}

/** GET /api/v1/quests/:edition */
export async function getQuestByEdition(req: Request, res: Response): Promise<void> {
  const { edition } = req.params as unknown as { edition: number };
  ok(res, await questService.getQuestByEdition(edition));
}
