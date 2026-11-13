import type { QuizDistribution } from '@bookquest/shared';
import { getT } from '@/i18n';

/** `quizIds[i]` is group i's quiz; '' is a group with no pick yet. */
export interface QuizConfigForm {
  distribution: QuizDistribution;
  quizIds: string[];
}

/** The splits behind "give different groups different quizzes"; labels live in `adminQuest.quiz.distribution`. */
export const SPLIT_DISTRIBUTIONS = ['parity', 'random'] as const satisfies readonly QuizDistribution[];
export type SplitDistribution = (typeof SPLIT_DISTRIBUTIONS)[number];

/** Client-side twin of shared `groupLabels`, in the reader's language. */
export function localGroupLabels(distribution: QuizDistribution, count: number): string[] {
  const t = getT().adminQuest.quiz;
  if (distribution === 'single') return [t.everyone];
  if (distribution === 'parity') return [t.odd, t.even];
  return Array.from({ length: count }, (_, i) => t.group(i + 1));
}

/** The API sends `groupLabels` output in English; known shapes are said in the reader's language. */
export function localizeGroupLabel(label: string): string {
  const t = getT().adminQuest.quiz;
  const known: Record<string, string> = { Everyone: t.everyone, 'Odd numbers': t.odd, 'Even numbers': t.even };
  const group = /^Group (\d+)$/.exec(label);
  return known[label] ?? (group ? t.group(Number(group[1])) : label);
}

/** Keeps the picks that still have a group; new groups start empty. */
export function resizeQuizIds(ids: string[], count: number): string[] {
  return Array.from({ length: count }, (_, i) => ids[i] ?? '');
}

export function quizConfigChanged(before: QuizConfigForm | null, after: QuizConfigForm | null): boolean {
  if (!before || !after) return before !== after;
  return (
    before.distribution !== after.distribution ||
    before.quizIds.length !== after.quizIds.length ||
    before.quizIds.some((id, i) => id !== after.quizIds[i])
  );
}

/** "Odd / even: Quiz A, Quiz B", for the review sheet. */
export function describeQuizConfig(config: QuizConfigForm | null, titleOf: (id: string) => string): string {
  const t = getT().adminQuest.quiz;
  if (!config) return t.none;
  const titles = config.quizIds.map((id) => (id ? titleOf(id) : t.noQuizYet)).join(', ');
  return `${t.distribution[config.distribution]}: ${titles}`;
}
