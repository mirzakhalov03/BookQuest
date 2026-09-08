import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodIssue, ZodType } from 'zod';
import { ApiError } from '../utils/api-error.js';

type Source = 'body' | 'query' | 'params';

/**
 * Parses one part of the request and replaces it with the parsed result, so
 * controllers receive normalised, typed data and never re-validate.
 */
export function validate<T>(schema: ZodType<T>, source: Source = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || source;
        fields[key] ??= describe(issue);
      }
      // The first message is the one a form would show inline.
      const first = Object.values(fields)[0] ?? 'Please check the details you entered.';
      next(ApiError.badRequest(first, fields));
      return;
    }

    Object.defineProperty(req, source, { value: result.data, writable: true });
    next();
  };
}

/**
 * Zod's own text is written for developers. Everything the shared schemas
 * produce is already a sentence meant for a person; this only covers the
 * structural issues zod raises before a schema's own rules run.
 */
function describe(issue: ZodIssue): string {
  if (issue.code === 'unrecognized_keys') {
    const [key] = issue.keys;
    return key ? `“${key}” is not something you can set here.` : 'Some of those fields are not editable.';
  }
  return issue.message;
}
