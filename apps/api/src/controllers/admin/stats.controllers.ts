import type { Request, Response } from 'express';
import * as adminService from '../../services/admin.services.js';
import { ok } from '../../utils/respond.js';

/** GET /api/v1/admin/stats */
export async function getStats(_req: Request, res: Response): Promise<void> {
  ok(res, await adminService.getStats());
}
