import type { Request, Response } from 'express';
import type { CreateQuestPayload, UpdateQuestPayload } from '@bookquest/shared';
import * as questService from '../../services/quest.services.js';
import * as resultService from '../../services/result.services.js';
import { auditAdmin } from '../../utils/audit.js';
import { ok } from '../../utils/respond.js';

/** GET /api/v1/admin/quests/current — with the quiz setup the public DTO leaves out. */
export async function getCurrentQuest(_req: Request, res: Response): Promise<void> {
  ok(res, await questService.getAdminCurrentQuest());
}

/** POST /api/v1/admin/quests */
export async function createQuest(req: Request, res: Response): Promise<void> {
  const payload = req.body as CreateQuestPayload;
  // Here, not in createQuest: result.services already imports quest.services, so the reverse would be a cycle.
  if (payload.makeCurrent) await resultService.rankOutgoingQuest();
  const quest = await questService.createQuest(payload);
  if (payload.makeCurrent) resultService.clearResultsCache();
  auditAdmin(req, 'create-quest', { edition: quest.edition, makeCurrent: payload.makeCurrent });
  ok(res, quest, 201);
}

/** PATCH /api/v1/admin/quests/:id */
export async function updateQuest(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const payload = req.body as UpdateQuestPayload;
  const quest = await questService.updateQuest(id, payload);
  resultService.clearResultsCache();
  auditAdmin(req, 'update-quest', { questId: id, changed: Object.keys(payload) });
  ok(res, quest);
}
