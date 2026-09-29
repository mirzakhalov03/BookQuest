import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import * as coverService from '../services/cover.services.js';
import { logger } from '../config/logger.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { auditAdmin } from '../utils/audit.js';
import { ok } from '../utils/respond.js';

/** POST /api/v1/admin/covers — `req.file` is guaranteed by `uploadCoverFile`. */
export async function uploadCover(req: Request, res: Response): Promise<void> {
  const cover = await coverService.uploadCover(req.file!, currentUser(req).id);
  auditAdmin(req, 'upload-cover', { coverId: cover.id });
  ok(res, { url: cover.url }, 201);
}

/** GET /api/v1/covers/:id */
export async function getCover(req: Request, res: Response): Promise<void> {
  const cover = await coverService.openCover((req.params as { id: string }).id);

  res.set({
    'Content-Type': cover.contentType,
    'Content-Length': String(cover.length),
    // A new cover is a new id, so a cached copy can never go stale.
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Helmet defaults to same-origin, which makes browsers blank the image on the web app's origin.
    'Cross-Origin-Resource-Policy': 'cross-origin'
  });

  try {
    await pipeline(cover.stream, res);
  } catch (error) {
    // Once bytes are out, the error middleware can't send an envelope; pipeline already closed the socket.
    if (!res.headersSent) throw error;
    logger.warn({ err: error }, 'Cover stream failed mid-response');
  }
}
