import type { format as En } from '../en/format';

export const format: typeof En = {
  justNow: 'hozirgina',
  minutesAgo: (n) => `${n} daqiqa oldin`,
  hoursAgo: (n) => `${n} soat oldin`,
  durationHms: (h, m, s) => `${h} soat ${m} daq ${s} son`,
  durationMs: (m, s) => `${m} daq ${s} son`,
  countdownAria: 'Qolgan vaqt',
  days: 'Kun',
  hours: 'Soat',
  minutes: 'Daqiqa',
  seconds: 'Soniya'
};
