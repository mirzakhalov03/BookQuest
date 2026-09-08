import { Router } from 'express';
import * as adminParticipantController from '../../controllers/admin/participant.controllers.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { adminParticipantQuery } from '../../validators/admin.validators.js';

export const adminParticipantRoutes: Router = Router();

adminParticipantRoutes.get(
  '/',
  validate(adminParticipantQuery, 'query'),
  adminParticipantController.listParticipants
);
