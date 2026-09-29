import { Router } from 'express';
import * as adminBroadcastController from '../../controllers/admin/broadcast.controllers.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createBroadcastBody } from '../../validators/admin.validators.js';

export const adminBroadcastRoutes: Router = Router();

adminBroadcastRoutes.get('/', adminBroadcastController.listBroadcasts);
adminBroadcastRoutes.post('/', validate(createBroadcastBody), adminBroadcastController.createBroadcast);
