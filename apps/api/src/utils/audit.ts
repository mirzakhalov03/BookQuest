import type { Request } from 'express';
import { logger } from '../config/logger.js';
import { currentUser } from '../middlewares/auth.middleware.js';

/**
 * Two admins at low volume do not justify an audit collection. What they do
 * justify is knowing who changed what: the acting Telegram id, the action, and
 * the keys touched — never the values, which can contain anything.
 */
export function auditAdmin(req: Request, action: string, detail: Record<string, unknown>): void {
  logger.info({ actor: currentUser(req).telegramUserId, action, ...detail }, 'Admin action');
}
