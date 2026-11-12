export const quizKeys = {
  all: ['quiz'] as const,
  me: () => [...quizKeys.all, 'me'] as const,
  attempt: () => [...quizKeys.all, 'attempt'] as const,
  review: () => [...quizKeys.all, 'review'] as const
};
