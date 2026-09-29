import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';
import { COVER_MESSAGES, type CoverUpload } from '@bookquest/shared';
import { publicApiUrl } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/api-error.js';
import { detectImageType } from '../utils/image-type.js';
import { OBJECT_ID_PATTERN } from '../utils/mongo.js';

const { GridFSBucket, ObjectId } = mongoose.mongo;
const COVER_URL_PREFIX = `${publicApiUrl}/api/v1/covers/`;

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
    throw ApiError.badRequest(COVER_MESSAGES.wrongType, { file: COVER_MESSAGES.wrongType });
  }

  const upload = coversBucket().openUploadStream(file.originalname, {
    metadata: { contentType, uploadedBy }
  });
  await pipeline(Readable.from(file.buffer), upload);

  const id = upload.id.toString();
  return { id, url: `${COVER_URL_PREFIX}${id}` };
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

/** Our own cover's id from a stored `coverUrl`; `null` for pasted external URLs. */
export function coverIdFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith(COVER_URL_PREFIX)) return null;
  const id = url.slice(COVER_URL_PREFIX.length);
  return OBJECT_ID_PATTERN.test(id) ? id : null;
}

/** Best effort: an orphaned few-KB file is not worth failing a quest save over. */
export async function discardCover(id: string): Promise<void> {
  try {
    await coversBucket().delete(new ObjectId(id));
  } catch (error) {
    logger.warn({ err: error, coverId: id }, 'Could not delete replaced cover');
  }
}
