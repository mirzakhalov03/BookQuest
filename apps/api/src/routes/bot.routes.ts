import { Router } from 'express';
import * as botController from '../controllers/bot.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireBotService } from '../middlewares/bot-service.middleware.js';
import { botUserUpsertBody } from '../validators/bot.validators.js';

export const botRoutes: Router = Router();

botRoutes.post('/users', requireBotService, validate(botUserUpsertBody), botController.upsertUser);
