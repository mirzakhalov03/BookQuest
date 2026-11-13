import type { CertificateTier } from '@bookquest/shared';

export const profile = {
  certTeaser: 'Finish the quiz to earn your certificate',
  certResultsOn: (date: string) => `Results on ${date}`,
  certMissed: "You didn't finish this edition. See you next time",
  tiers: { gold: 'Gold', silver: 'Silver', bronze: 'Bronze', participant: 'Participant' } satisfies Record<CertificateTier, string>,
  verifyCode: (code: string) => `Verify code ${code}`,
  meetMascot: 'Meet your mascot! Tap to change it',
  loading: 'Finding your number…',
  readerFallback: 'Reader',
  registrationClosed: 'Registration for this edition has closed. See you at the next one.',
  nextEditionSoon: 'The next edition opens soon.',
  adminDashboard: 'Admin dashboard',
  certificates: 'Certificates & awards',
  pickAvatar: 'Pick your avatar',
  initials: 'Initials',
  avatars: {
    rabbit: 'Rabbit',
    bear: 'Bear',
    queen: 'Queen',
    'cool-duck': 'Cool duck',
    'arctic-fox': 'Arctic fox',
    duck: 'Duck',
    'arctic-hare': 'Arctic hare',
    'baby-penguin': 'Baby penguin'
  },
  changeAvatar: 'Change avatar',
  participantNumber: 'Participant number',
  numberHint: 'On the leaderboard and your certificate',
  shareTitle: 'My BookQuest certificate',
  linkCopied: 'Verification link copied.',
  certificateAlt: (name: string, year: number, place: string | null) =>
    `Certificate for ${name}, BookQuest ${year}${place ? `, ${place}` : ''}`,
  download: 'Save image',
  share: 'Share',
  connectTelegram: 'Connect Telegram',
  connectTelegramBody: 'Link your Telegram account for a faster sign-in next time.',
  connecting: 'Connecting…',
  connectFailed: 'Telegram confirmed you, but connecting failed. Try again.',
  language: 'Language',
  avatarFailed: "Couldn't save your avatar. Try again."
};
