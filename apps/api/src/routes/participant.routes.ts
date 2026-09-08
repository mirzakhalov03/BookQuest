import { Router } from 'express';
import * as participantController from '../controllers/participant.controllers.js';
import * as resultController from '../controllers/result.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireUser } from '../middlewares/auth.middleware.js';
import { registerRateLimit } from '../middlewares/rate-limit.middleware.js';
import {
  participantNumberParams,
  registerParticipantBody
} from '../validators/participant.validators.js';

export const participantRoutes: Router = Router();

/* Every route here needs a session. Participant numbers are sequential, so an
   open lookup is an enumeration of every name in the contest. */
participantRoutes.use(requireUser);

participantRoutes.post(
  '/',
  registerRateLimit,
  validate(registerParticipantBody),
  participantController.register
);

participantRoutes.get('/me', participantController.getMyRegistration);
participantRoutes.get('/me/certificate', resultController.getMyCertificate);

// Last, so it cannot swallow /me.
participantRoutes.get(
  '/:number',
  validate(participantNumberParams, 'params'),
  participantController.getByNumber
);
