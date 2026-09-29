import { Router } from 'express';
import * as coverController from '../../controllers/cover.controllers.js';
import { uploadCoverFile } from '../../middlewares/upload.middleware.js';

export const adminCoverRoutes: Router = Router();

adminCoverRoutes.post('/', uploadCoverFile, coverController.uploadCover);
