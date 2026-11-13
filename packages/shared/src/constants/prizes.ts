import type { Prizes } from '../schemas/quest.js';

/** The five prize places, defined once: admin form, podium, ranked list, archive line and Home CTA all read this. */
export const PRIZE_PLACES = [
  { key: 'first', rank: 1 },
  { key: 'second', rank: 2 },
  { key: 'third', rank: 3 },
  { key: 'fourth', rank: 4 },
  { key: 'fifth', rank: 5 }
] as const;

export type PrizePlaceKey = (typeof PRIZE_PLACES)[number]['key'];

/** How many places have a prize set. The photo doesn't count; it shows the prizes, it isn't one. */
export function countPrizes(prizes: Prizes): number {
  return PRIZE_PLACES.filter(({ key }) => prizes[key]).length;
}

export const hasAnyPrize = (prizes: Prizes): boolean => countPrizes(prizes) > 0;
