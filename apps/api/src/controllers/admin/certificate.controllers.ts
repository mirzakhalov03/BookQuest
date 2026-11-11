import type { Request, Response } from 'express';
import * as deliveryService from '../../services/certificate-delivery.services.js';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ok } from '../../utils/respond.js';

/** POST /api/v1/admin/certificates/send — 202: sending continues in the background. */
export async function sendCertificates(req: Request, res: Response): Promise<void> {
  ok(res, await deliveryService.startCertificateDelivery(currentUser(req)), 202);
}

/** GET /api/v1/admin/certificates/delivery */
export async function getDelivery(_req: Request, res: Response): Promise<void> {
  ok(res, await deliveryService.getDeliveryStatus());
}
