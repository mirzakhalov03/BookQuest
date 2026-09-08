import type { Request, Response } from 'express';
import type { RegisterParticipantPayload } from '@bookquest/shared';
import * as participantService from '../services/participant.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';

/** POST /api/v1/participants */
export async function register(req: Request, res: Response): Promise<void> {
  const participant = await participantService.registerParticipant(
    currentUser(req),
    req.body as RegisterParticipantPayload
  );
  ok(res, participant, 201);
}

/** GET /api/v1/participants/me */
export async function getMyRegistration(req: Request, res: Response): Promise<void> {
  ok(res, await participantService.requireParticipantForUser(currentUser(req)));
}

/** GET /api/v1/participants/:number */
export async function getByNumber(req: Request, res: Response): Promise<void> {
  const { number } = req.params as unknown as { number: number };
  ok(res, await participantService.getParticipantByNumber(number));
}
