/**
 * Mirrors `questKeys`' shape (an `all` root plus one function per query), so
 * a `PATCH` in `useUpdateQuest` has an explicit list to invalidate instead of
 * guessing at string literals scattered across the feature.
 */
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  participants: (params: object) => [...adminKeys.all, 'participants', params] as const,
  quizzes: () => [...adminKeys.all, 'quizzes'] as const,
  quiz: (id: string) => [...adminKeys.all, 'quizzes', id] as const,
  quizOps: () => [...adminKeys.all, 'quizOps'] as const,
  quizLive: () => [...adminKeys.quizOps(), 'live'] as const,
  quizAttempts: (params: object) => [...adminKeys.quizOps(), 'attempts', params] as const,
  quizAttempt: (id: string) => [...adminKeys.quizOps(), 'attempt', id] as const,
  quizStandings: () => [...adminKeys.quizOps(), 'standings'] as const,
  groupSizes: (distribution: string, groups: number) =>
    [...adminKeys.all, 'groupSizes', distribution, groups] as const,
  latestQuest: () => [...adminKeys.all, 'latestQuest'] as const,
  currentQuest: () => [...adminKeys.all, 'currentQuest'] as const,
  broadcasts: () => [...adminKeys.all, 'broadcasts'] as const,
  certificateDelivery: () => [...adminKeys.all, 'certificateDelivery'] as const,
  interactions: (params: object) => [...adminKeys.all, 'interactions', 'list', params] as const,
  interactionsNew: (params: object) => [...adminKeys.all, 'interactions', 'new', params] as const,
  interactionFacets: (params: object) =>
    [...adminKeys.all, 'interactions', 'facets', params] as const
};
