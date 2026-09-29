import type { RequestHandler } from 'express';
import multer from 'multer';
import { COVER_MAX_BYTES, COVER_MESSAGES } from '@bookquest/shared';
import { ApiError } from '../utils/api-error.js';

// Memory storage: covers are ≤5MB and go straight to GridFS, so a temp file would only add cleanup.
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COVER_MAX_BYTES, files: 1 }
}).single('file');

/** Parses one `file` field and turns multer's errors into the API's own envelope. */
export const uploadCoverFile: RequestHandler = (req, res, next) => {
  coverUpload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new ApiError(413, 'validation_failed', COVER_MESSAGES.tooLarge, { file: COVER_MESSAGES.tooLarge }));
      return;
    }
    if (error || !req.file) {
      next(ApiError.badRequest(COVER_MESSAGES.missing, { file: COVER_MESSAGES.missing }));
      return;
    }
    next();
  });
};
