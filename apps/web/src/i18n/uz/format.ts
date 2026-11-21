import type { format as En } from '../en/format';

// iOS and Telegram WebViews ship no Uzbek month names, so `Intl` prints "2026 M12 5" there.
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

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
  seconds: 'Soniya',
  manualDates: {
    long: (day, month, year) => `${day}-${MONTHS[month]} ${year}`,
    short: (day, month) => `${day}-${MONTHS_SHORT[month]}`
  }
};
