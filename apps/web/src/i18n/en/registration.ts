import { ordinalWordEn } from './ordinal';

export const registration = {
  editionLine: (edition: number) => `${ordinalWordEn(edition)} annual reading competition`,
  youreIn: 'You’re in.',
  yourNumber: 'Your participant number',
  numberAria: (n: number) => `Participant number ${n}`,
  keepNumber: 'Keep this number. It identifies you on the leaderboard, on your quiz sheet and on your certificate.',
  seeProfile: 'See your profile',
  contactTelegram: 'Telegram',
  contactPhone: 'Phone',
  telegramPlaceholder: '@your_username',
  howWeReachYou: 'How we reach you',
  contactMethod: 'Contact method',
  claiming: 'Claiming your place…',
  claim: 'Claim your place',
  numberNote: 'Your number goes on the leaderboard, your quiz sheet and your certificate.'
};
