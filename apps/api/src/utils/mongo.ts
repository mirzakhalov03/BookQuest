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

/** `insertMany({ ordered: false })` throws even when every failure is a duplicate — a retried batch, which is success. */
export function isOnlyDuplicateKeyErrors(error: unknown): boolean {
  const raw = (error as { writeErrors?: unknown } | null)?.writeErrors;
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as {
    code?: number;
    err?: { code?: number };
  }[];
  return list.length > 0 && list.every((entry) => (entry.code ?? entry.err?.code) === 11000);
}
