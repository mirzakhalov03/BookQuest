export const format = {
  justNow: 'just now',
  minutesAgo: (n: number) => `${n} min ago`,
  hoursAgo: (n: number) => `${n} h ago`,
  durationHms: (h: number, m: string, s: string) => `${h}h ${m}m ${s}s`,
  durationMs: (m: number, s: string) => `${m}m ${s}s`,
  countdownAria: 'Time remaining',
  days: 'Days',
  hours: 'Hours',
  minutes: 'Minutes',
  seconds: 'Seconds'
};
