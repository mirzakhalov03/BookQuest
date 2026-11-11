import crypto from 'node:crypto';
import type { Types } from 'mongoose';
import type { QuizDistribution } from '@bookquest/shared';

export { groupLabels } from '@bookquest/shared';

/**
 * Which group (index into `quizConfig.quizzes`) a participant sits (§7.4).
 * Parity uses the official number; random hashes each person on their own,
 * so adding or removing anyone never moves anyone else.
 */
export function resolveGroup(
  config: { distribution: QuizDistribution; quizzes: unknown[]; seed: string | null },
  participant: { _id: Types.ObjectId; number: number }
): number {
  switch (config.distribution) {
    case 'single':
      return 0;
    case 'parity':
      return participant.number % 2 === 1 ? 0 : 1;
    case 'random': {
      const digest = crypto.createHmac('sha256', config.seed!).update(String(participant._id)).digest();
      return digest.readUInt32BE(0) % config.quizzes.length;
    }
  }
}
