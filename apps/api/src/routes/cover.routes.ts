import { Router } from 'express';
import * as coverController from '../controllers/cover.controllers.js';

export const coverRoutes: Router = Router();

coverRoutes.get('/:id', coverController.getCover);
