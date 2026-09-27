export const notificationKeys = {
  all: ['notifications'] as const,
  mine: () => [...notificationKeys.all, 'me'] as const
};
