import { QUIZ_FLAG_LABEL, type AttemptAdmin } from '@bookquest/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { sendTelegramMessage } from '../utils/telegram-send.js';
import { getAttemptAdmin } from './quiz-ops.services.js';

type Item = AttemptAdmin['items'][number];

// Telegram's cap is 4096; the margin covers multi-byte counting quirks.
const MESSAGE_LIMIT = 3900;

const STATUS: Record<AttemptAdmin['status'], string> = {
  in_progress: 'Still solving',
  completed: 'Finished',
  voided: 'Voided'
};

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: env.ORGANISER_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});
const clock = (iso: string | null) => (iso ? clockFormat.format(new Date(iso)) : '—');
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function duration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
}

const optionText = (item: Item, id: string | null) => item.options.find((option) => option.id === id)?.text ?? '—';

function itemMark(item: Item): string {
  if (item.voided) return '⚪️';
  if (item.outcome === null) return '…';
  if (item.outcome === 'timeout' || item.outcome === 'unserved') return '⏱';
  return item.isCorrect ? '✅' : '❌';
}

function itemBlock(item: Item): string {
  const head = `${item.index + 1}. ${itemMark(item)} ${item.prompt}`;
  const lines = [head];

  if (item.selectedOptionId) {
    const took = item.elapsedMs !== null ? ` · ${seconds(item.elapsedMs)}` : '';
    lines.push(`   → ${optionText(item, item.selectedOptionId)} (at ${clock(item.selectedAt)}${took})`);
  } else {
    lines.push(`   → ${item.outcome === 'unserved' ? 'Not reached' : item.outcome === null ? 'Pending' : 'No answer'}`);
  }
  if (item.isCorrect === false || (!item.selectedOptionId && item.outcome !== null)) {
    lines.push(`   ✓ ${optionText(item, item.correctOptionId)}`);
  }
  if (item.signals.hiddenCount > 0) {
    lines.push(`   left the app ${item.signals.hiddenCount}× for ${seconds(item.signals.hiddenMs)}`);
  }
  if (item.voided) lines.push('   question voided, not scored');
  return lines.join('\n');
}

export function formatAnswerSheet(attempt: AttemptAdmin): string {
  const { participant } = attempt;
  const summary = [
    attempt.score !== null ? `Score ${attempt.score}/${attempt.total}` : `${attempt.answered}/${attempt.total} answered`,
    attempt.durationMs !== null ? duration(attempt.durationMs) : null,
    `${attempt.clientIdCount} ${attempt.clientIdCount === 1 ? 'device' : 'devices'}`
  ].filter(Boolean);

  const header = [
    '📋 Answer sheet',
    `#${participant.number} · ${participant.fullName}`,
    `${attempt.groupLabel} · “${attempt.quizTitle}” · ${STATUS[attempt.status]}`,
    summary.join(' · '),
    `Started ${clock(attempt.startedAt)} · finished ${clock(attempt.completedAt)} (${env.ORGANISER_TIME_ZONE})`,
    attempt.flags.length > 0 ? `Flags: ${attempt.flags.map((flag) => QUIZ_FLAG_LABEL[flag]).join(', ')}` : null,
    attempt.voidReason ? `Voided: ${attempt.voidReason}` : null
  ].filter(Boolean);

  return [header.join('\n'), ...attempt.items.map(itemBlock)].join('\n\n');
}

/** Splits on blank lines so no question is cut across two messages. */
function chunk(text: string): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const block of text.split('\n\n')) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > MESSAGE_LIMIT && current) {
      chunks.push(current);
      current = block.slice(0, MESSAGE_LIMIT);
    } else {
      current = next.slice(0, MESSAGE_LIMIT);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** DMs the full sheet to the admin who asked; sequential so the parts arrive in order. */
export async function sendAnswerSheet(attemptId: string, admin: UserDocument): Promise<void> {
  if (!admin.telegramUserId) {
    throw ApiError.conflict('Your admin account is not linked to Telegram, so there is nowhere to send it.');
  }
  const attempt = await getAttemptAdmin(attemptId);

  for (const part of chunk(formatAnswerSheet(attempt))) {
    const outcome = await sendTelegramMessage(admin.telegramUserId, part);
    if (outcome.status !== 'sent') {
      logger.warn({ attemptId, outcome }, 'answer sheet send failed');
      throw ApiError.conflict(
        outcome.status === 'blocked'
          ? 'The bot cannot message you. Open it in Telegram and press Start, then try again.'
          : 'Telegram did not take the message. Try again in a moment.'
      );
    }
  }
}
