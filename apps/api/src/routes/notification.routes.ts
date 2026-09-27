import { Router } from 'express';
import * as notificationController from '../controllers/notification.controllers.js';
import { requireUser } from '../middlewares/auth.middleware.js';

export const notificationRoutes: Router = Router();

notificationRoutes.get('/', requireUser, notificationController.listMine);
notificationRoutes.post('/:id/read', requireUser, notificationController.markRead);
