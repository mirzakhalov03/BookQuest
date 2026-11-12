import type { format as En } from '../en/format';

export const format: typeof En = {
  justNow: 'только что',
  minutesAgo: (n) => `${n} мин назад`,
  hoursAgo: (n) => `${n} ч назад`,
  durationHms: (h, m, s) => `${h} ч ${m} мин ${s} с`,
  durationMs: (m, s) => `${m} мин ${s} с`,
  countdownAria: 'Осталось времени',
  days: 'Дни',
  hours: 'Часы',
  minutes: 'Минуты',
  seconds: 'Секунды'
};
