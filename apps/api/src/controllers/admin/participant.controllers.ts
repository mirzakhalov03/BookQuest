import type { Request, Response } from 'express';
import * as adminService from '../../services/admin.services.js';
import { ok } from '../../utils/respond.js';

/** GET /api/v1/admin/participants */
export async function listParticipants(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as adminService.ParticipantQuery;
  ok(res, await adminService.listParticipants(query));
}
