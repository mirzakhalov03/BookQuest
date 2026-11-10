import { Router } from 'express';
import * as adminInteractionController from '../../controllers/admin/interaction.controllers.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  adminInteractionFacetsQuery,
  adminInteractionQuery
} from '../../validators/admin.validators.js';

export const adminInteractionRoutes: Router = Router();

adminInteractionRoutes.get(
  '/facets',
  validate(adminInteractionFacetsQuery, 'query'),
  adminInteractionController.getFacets
);
adminInteractionRoutes.get(
  '/',
  validate(adminInteractionQuery, 'query'),
  adminInteractionController.listInteractions
);
