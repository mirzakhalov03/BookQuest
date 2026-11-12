import type { NextFunction, Request, Response } from 'express';

/** Mounted first, so the quiz clock stops when an answer arrives, not after auth and DB reads. */
export function stampReceivedAt(req: Request, _res: Response, next: NextFunction): void {
  req.receivedAt = new Date();
  next();
}
