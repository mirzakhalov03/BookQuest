import { getT } from '@/i18n';

/** "10 min", "45 s" or "1 min 30 s": totals are short enough that seconds still matter. */
export function formatQuizDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const t = getT().adminQuiz;
  if (minutes === 0) return t.durSec(seconds);
  return seconds === 0 ? t.durMin(minutes) : t.durMinSec(minutes, seconds);
}
