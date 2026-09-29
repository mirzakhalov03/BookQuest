/**
 * MongoDB reports a unique-index violation as error code 11000. It is the only
 * driver error we translate, because it is the only one that means "the user
 * did something reasonable that collided" rather than "the server is broken".
 */
export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

/** A 24-hex ObjectId string. Stricter than `ObjectId.isValid`, which also accepts any 12-char string. */
export const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
