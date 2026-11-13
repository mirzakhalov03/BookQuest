import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';
import { COVER_MESSAGES, type CoverUpload } from '@bookquest/shared';
import { publicApiUrl } from '../config/env.js';
import { logger } from '../config/logger.js';
import { QuestModel } from '../models/quest.model.js';
import { ApiError } from '../utils/api-error.js';
import { detectImageType } from '../utils/image-type.js';
import { OBJECT_ID_PATTERN } from '../utils/mongo.js';

const { GridFSBucket, ObjectId } = mongoose.mongo;
// Own covers are stored by path, so a domain change can't break them; the origin is added on the way out.
export const COVER_PATH = '/api/v1/covers/';
// Uploads older than this that no quest points at were abandoned before saving.
const ORPHAN_AFTER_MS = 24 * 60 * 60 * 1000;
const COVER_ID_ANY_ORIGIN = new RegExp(`${COVER_PATH}([0-9a-f]{24})$`, 'i');

let bucket: InstanceType<typeof GridFSBucket> | null = null;

// Lazy: the connection's `db` only exists after connectToDatabase() resolves.
function coversBucket(): InstanceType<typeof GridFSBucket> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  bucket ??= new GridFSBucket(db, { bucketName: 'covers' });
  return bucket;
}

export async function uploadCover(
  file: { buffer: Buffer; originalname: string },
  uploadedBy: string
): Promise<CoverUpload & { id: string }> {
  const contentType = detectImageType(file.buffer);
  if (!contentType) {
    throw ApiError.badRequest(COVER_MESSAGES.wrongType, { file: COVER_MESSAGES.wrongType }, 'cover_wrong_type');
  }

  const upload = coversBucket().openUploadStream(file.originalname, {
    metadata: { contentType, uploadedBy }
  });
  await pipeline(Readable.from(file.buffer), upload);

  const id = upload.id.toString();
  return { id, url: toPublicCoverUrl(`${COVER_PATH}${id}`)! };
}

/** A malformed id is reported as missing, so ids can't be probed by format. */
export async function openCover(id: string) {
  if (!OBJECT_ID_PATTERN.test(id)) throw ApiError.notFound('No such cover.');

  const _id = new ObjectId(id);
  const [file] = await coversBucket().find({ _id }).limit(1).toArray();
  if (!file) throw ApiError.notFound('No such cover.');

  return {
    contentType: String(file.metadata?.contentType ?? 'application/octet-stream'),
    length: file.length,
    stream: coversBucket().openDownloadStream(_id)
  };
}

/** What goes in the database: our covers as a path, pasted external URLs untouched. */
export function toStoredCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith(`${publicApiUrl}${COVER_PATH}`) ? url.slice(publicApiUrl.length) : url;
}

/** What browsers get: our stored paths made absolute. */
export function toPublicCoverUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  return stored.startsWith(COVER_PATH) ? `${publicApiUrl}${stored}` : stored;
}

/** Our own cover's id from a stored or public `coverUrl`; `null` for pasted external URLs. */
export function coverIdFromUrl(url: string | null | undefined): string | null {
  const stored = toStoredCoverUrl(url);
  if (!stored?.startsWith(COVER_PATH)) return null;
  const id = stored.slice(COVER_PATH.length);
  return OBJECT_ID_PATTERN.test(id) ? id : null;
}

/** Deletes uploads no quest references once they are old enough to be abandoned. Returns how many went. */
export async function sweepOrphanCovers(now = Date.now()): Promise<number> {
  // Book covers and prize photos share the bucket, so both protect their files.
  const quests = await QuestModel.find(
    { $or: [{ 'book.coverUrl': { $type: 'string' } }, { 'prizes.photoUrl': { $type: 'string' } }] },
    'book.coverUrl prizes.photoUrl'
  ).lean();
  // Any origin counts, so a row saved under an old domain (not yet migrated) still protects its file.
  const referenced = new Set(
    quests.flatMap((quest) =>
      [quest.book?.coverUrl, quest.prizes?.photoUrl].map((url) => COVER_ID_ANY_ORIGIN.exec(url ?? '')?.[1])
    )
  );

  const stale = await coversBucket()
    .find({ uploadDate: { $lt: new Date(now - ORPHAN_AFTER_MS) } }, { projection: { _id: 1 } })
    .toArray();
  const orphans = stale.filter((file) => !referenced.has(file._id.toString()));

  for (const file of orphans) await discardCover(file._id.toString());
  return orphans.length;
}

/** Best effort: an orphaned few-KB file is not worth failing a quest save over. */
export async function discardCover(id: string): Promise<void> {
  try {
    await coversBucket().delete(new ObjectId(id));
  } catch (error) {
    logger.warn({ err: error, coverId: id }, 'Could not delete replaced cover');
  }
}
