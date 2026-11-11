import type { QuizDistribution } from '@bookquest/shared';

/** `quizIds[i]` is group i's quiz; '' is a group with no pick yet. */
export interface QuizConfigForm {
  distribution: QuizDistribution;
  quizIds: string[];
}

export const DISTRIBUTION_OPTIONS = [
  { value: 'single', label: 'One quiz' },
  { value: 'parity', label: 'Odd / even' },
  { value: 'random', label: 'Random groups' }
] as const satisfies readonly { value: QuizDistribution; label: string }[];

const DISTRIBUTION_LABEL: Record<QuizDistribution, string> = {
  single: 'One quiz',
  parity: 'Odd / even',
  random: 'Random groups'
};

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
  if (!config) return 'None';
  const titles = config.quizIds.map((id) => (id ? titleOf(id) : 'No quiz yet')).join(', ');
  return `${DISTRIBUTION_LABEL[config.distribution]}: ${titles}`;
}
