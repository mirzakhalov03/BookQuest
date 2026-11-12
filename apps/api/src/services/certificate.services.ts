import type { Types } from 'mongoose';
import { certificateTier, normalizeCertificateCode, type CertificateData } from '@bookquest/shared';
import { ResultModel } from '../models/result.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { QuestModel } from '../models/quest.model.js';
import type { UserDocument } from '../models/user.model.js';
import { publicApiUrl, webAppUrl } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';
import { renderCertificatePng } from '../certificates/render.js';
import { CERTIFICATE_SAMPLES, type CertificateSampleKey } from '../certificates/samples.js';
import { requireCurrentQuestDocument } from './quest.services.js';
import { requireParticipantForUser } from './participant.services.js';
import { ensureRanked, requirePublished } from './result.services.js';

interface CertificateSource {
  result: { certificateCode?: string | null; rank?: number | null };
  participant: { number: number; fullName: string };
  quest: { edition: number; year: number; book: { title: string; author: string }; resultsAt: Date };
  finishedCount: number;
}

/** The only place CertificateData is assembled, so /me, verify, the image and the bot can't drift apart. */
export function buildCertificateData({ result, participant, quest, finishedCount }: CertificateSource): CertificateData {
  const code = result.certificateCode ?? '';
  return {
    code,
    fullName: participant.fullName,
    participantNumber: participant.number,
    questEdition: quest.edition,
    questYear: quest.year,
    bookTitle: quest.book.title,
    bookAuthor: quest.book.author,
    ...certificateTier(result.rank ?? null),
    finishedCount,
    issuedAt: quest.resultsAt.toISOString(),
    imageUrl: `${publicApiUrl}/api/v1/certificates/${code}/image.png`,
    verifyUrl: `${webAppUrl}/verify/${code}`
  };
}

export function countFinishers(questId: Types.ObjectId): Promise<number> {
  return ResultModel.countDocuments({ quest: questId });
}

export async function getCertificateForUser(user: UserDocument): Promise<CertificateData> {
  const quest = await requireCurrentQuestDocument();
  requirePublished(quest);
  await ensureRanked(quest);

  const participant = await requireParticipantForUser(user, quest);
  const result = await ResultModel.findOne({ quest: quest._id, participant: participant.id }).lean();
  if (!result) throw ApiError.notFound('There is no completed quiz to certify yet.', { reason: 'no_certificate' });

  return buildCertificateData({ result, participant, quest, finishedCount: await countFinishers(quest._id) });
}

/** Any edition: a 2025 certificate must still verify in 2027. Holding the code is the permission. */
export async function getCertificateByCode(raw: string): Promise<CertificateData> {
  const code = normalizeCertificateCode(raw);
  const notFound = () => ApiError.notFound('We couldn’t find a certificate with this code.', { reason: 'certificate_not_found' });
  if (!code) throw notFound();

  const result = await ResultModel.findOne({ certificateCode: code }).lean();
  if (!result) throw notFound();

  const [participant, quest, finishedCount] = await Promise.all([
    ParticipantModel.findById(result.participant).select('number fullName').lean(),
    QuestModel.findById(result.quest).lean(),
    countFinishers(result.quest)
  ]);
  if (!participant || !quest) throw notFound();

  return buildCertificateData({ result, participant, quest, finishedCount });
}

export async function getCertificateImage(raw: string) {
  const data = await getCertificateByCode(raw);
  return { ...(await renderCertificatePng(data)), data };
}

export function getSampleImage(key: CertificateSampleKey) {
  return renderCertificatePng(CERTIFICATE_SAMPLES[key], { sample: true });
}

/** Named by code, not by person: response headers are logged, and names never go in logs. */
export function certificateFileName(data: CertificateData): string {
  return `BookQuest-${data.questYear}-${data.code}.png`;
}
