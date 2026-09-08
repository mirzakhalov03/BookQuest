import type { UserDocument } from '../models/user.model.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Set only by the auth middleware, only from a verified token, and only
       * after loading the user from the database. Nothing the client sends can
       * put a value here.
       */
      currentUser?: UserDocument;
    }
  }
}

export {};
