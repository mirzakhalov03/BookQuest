import type { Request, Response } from 'express';
import type { CreateQuestPayload, UpdateQuestPayload } from '@bookquest/shared';
import * as questService from '../../services/quest.services.js';
import * as resultService from '../../services/result.services.js';
import { auditAdmin } from '../../utils/audit.js';
import { ok } from '../../utils/respond.js';

/** POST /api/v1/admin/quests */
export async function createQuest(req: Request, res: Response): Promise<void> {
  const payload = req.body as CreateQuestPayload;
  // Here, not in createQuest: result.services already imports quest.services, so the reverse would be a cycle.
  if (payload.makeCurrent) await resultService.rankOutgoingQuest();
  const quest = await questService.createQuest(payload);
  auditAdmin(req, 'create-quest', { edition: quest.edition, makeCurrent: payload.makeCurrent });
  ok(res, quest, 201);
}

/** PATCH /api/v1/admin/quests/:id */
export async function updateQuest(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const payload = req.body as UpdateQuestPayload;
  const quest = await questService.updateQuest(id, payload);
  auditAdmin(req, 'update-quest', { questId: id, changed: Object.keys(payload) });
  ok(res, quest);
}

/** POST /api/v1/admin/quests/:id/make-current */
export async function makeQuestCurrent(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const quest = await questService.makeQuestCurrent(id);
  auditAdmin(req, 'make-quest-current', { questId: id });
  ok(res, quest);
}
