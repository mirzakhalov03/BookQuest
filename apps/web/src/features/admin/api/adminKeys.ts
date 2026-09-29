/**
 * Mirrors `questKeys`' shape (an `all` root plus one function per query), so
 * a `PATCH` in `useUpdateQuest` has an explicit list to invalidate instead of
 * guessing at string literals scattered across the feature.
 *
 * `results` gets its own key rather than sharing `resultsKeys.current()` from
 * `features/results/api/useQuestResults` — same endpoint, but importing that
 * feature's key factory would be reaching into its internals for a query key
 * the way the brief already flagged for its components (spec §4 rule 1).
 * The cost is one duplicate cache entry for the same GET; that's cheaper
 * than the coupling.
 */
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  participants: (params: object) => [...adminKeys.all, 'participants', params] as const,
  results: () => [...adminKeys.all, 'results'] as const,
  latestQuest: () => [...adminKeys.all, 'latestQuest'] as const,
  broadcasts: () => [...adminKeys.all, 'broadcasts'] as const
};
