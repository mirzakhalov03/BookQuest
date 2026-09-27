import { Router } from 'express';
import * as notificationController from '../controllers/notification.controllers.js';
import { requireUser } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { notificationIdParams } from '../validators/notification.validators.js';

export const notificationRoutes: Router = Router();

notificationRoutes.get('/', requireUser, notificationController.listMine);
notificationRoutes.post(
  '/:id/read',
  requireUser,
  validate(notificationIdParams, 'params'),
  notificationController.markRead
);
