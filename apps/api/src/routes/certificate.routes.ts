import { Router } from 'express';
import * as certificateController from '../controllers/certificate.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { certificateRateLimit } from '../middlewares/rate-limit.middleware.js';
import {
  certificateCodeParams,
  certificateImageQuery,
  certificateSampleParams
} from '../validators/certificate.validators.js';

export const certificateRoutes: Router = Router();

// Public by design: the QR code on paper opens these with no session.
certificateRoutes.use(certificateRateLimit);

// Before /:code, so "preview" is never read as a code.
certificateRoutes.get(
  '/preview/:sample.png',
  validate(certificateSampleParams, 'params'),
  certificateController.getPreview
);
certificateRoutes.get(
  '/:code/image.png',
  validate(certificateCodeParams, 'params'),
  validate(certificateImageQuery, 'query'),
  certificateController.getImage
);
certificateRoutes.get('/:code', validate(certificateCodeParams, 'params'), certificateController.getByCode);
