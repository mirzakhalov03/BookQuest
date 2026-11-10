import { Types } from 'mongoose';
import { z } from 'zod';
import { OBJECT_ID_PATTERN } from './mongo.js';

export interface Cursor {
  sentAt: Date;
  id: Types.ObjectId;
}

const cursorShape = z.object({ s: z.iso.datetime(), i: z.string().regex(OBJECT_ID_PATTERN) });

/** Opaque to clients: base64url JSON of the row's (sentAt, _id), the list's sort key. */
export function encodeCursor(sentAt: Date, id: Types.ObjectId): string {
  return Buffer.from(JSON.stringify({ s: sentAt.toISOString(), i: id.toHexString() })).toString(
    'base64url'
  );
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = cursorShape.safeParse(
      JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    );
    return parsed.success
      ? { sentAt: new Date(parsed.data.s), id: new Types.ObjectId(parsed.data.i) }
      : null;
  } catch {
    return null;
  }
}
