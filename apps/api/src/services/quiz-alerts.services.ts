import { QUIZ_LATENCY_REFUND_MAX_MS } from '@bookquest/shared';
import { logger } from '../config/logger.js';
import type { AttemptRow } from '../models/quiz-attempt.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { UserModel } from '../models/user.model.js';
import { sendTelegramMessage } from '../utils/telegram-send.js';
import { cappedClaims } from './quiz-scoring.js';

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/**
 * Tells every admin on Telegram when a finished attempt had answers whose phone-reported time sat
 * at or past the refund cap below the server's. Once per attempt (finalise runs once); never throws.
 */
export async function alertCappedClaims(attempt: Pick<AttemptRow, '_id' | 'participant' | 'items'>): Promise<void> {
  const gaps = cappedClaims(attempt.items);
  if (gaps.length === 0) return;
  try {
    const [participant, admins] = await Promise.all([
      ParticipantModel.findById(attempt.participant).select('number fullName').lean<{ number: number; fullName: string }>(),
      UserModel.find({ role: 'admin', telegramUserId: { $exists: true, $ne: null } })
        .select('telegramUserId')
        .lean<{ telegramUserId: string }[]>()
    ]);
    const answered = attempt.items.filter((item) => item.outcome === 'locked').length;
    const who = participant ? `#${participant.number} · ${participant.fullName}` : `attempt ${String(attempt._id)}`;
    const text = [
      '⏱ Quiz timing: refund cap reached',
      who,
      `${gaps.length} of ${answered} answers: the phone reported ${seconds(QUIZ_LATENCY_REFUND_MAX_MS)}+ less than the server measured (largest gap ${seconds(Math.max(...gaps))}).`,
      `Each was counted at server time − ${seconds(QUIZ_LATENCY_REFUND_MAX_MS)}. Flagged "Time claims capped" in Admin → Quiz → Live.`
    ].join('\n');
    await Promise.all(admins.map((admin) => sendTelegramMessage(admin.telegramUserId, text)));
    logger.info({ attemptId: String(attempt._id), capped: gaps.length, admins: admins.length }, 'quiz refund-cap alert sent');
  } catch (error) {
    logger.error({ err: error, attemptId: String(attempt._id) }, 'quiz refund-cap alert failed');
  }
}
