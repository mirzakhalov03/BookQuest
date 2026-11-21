import { ordinalWordEn } from './ordinal';

export const registration = {
  editionLine: (edition: number) => `${ordinalWordEn(edition)} annual reading competition`,
  youreIn: 'You’re in.',
  yourNumber: 'Your participant number',
  numberAria: (n: number) => `Participant number ${n}`,
  keepNumber: 'Keep this number. It identifies you on the leaderboard, on your quiz sheet and on your certificate.',
  seeProfile: 'See your profile',
  meetMascot: 'And this is your mascot',
  contactTelegram: 'Telegram',
  contactPhone: 'Phone',
  telegramPlaceholder: '@your_username',
  howWeReachYou: 'How we reach you',
  contactMethod: 'Contact method',
  claiming: 'Registering…',
  claim: 'Register',
  whyAsk: 'Why we ask',
  whyName: 'So we know a real person is taking part. We may also use it later to confirm it’s you when you sign in.',
  whyContact: 'So we can reach you to hand over your prize if you win.',
  numberNote: 'Your number goes on the leaderboard, your quiz sheet and your certificate.',
  alreadyJoinedTitle: 'You’ve already joined in Telegram',
  alreadyJoinedBody: (handle: string) => `${handle} is already in this quest from Telegram. Sign in with a Telegram code to use that account, so you keep one number.`,
  signInInstead: 'Sign in with Telegram',
  notYou: 'Not you? Continue anyway'
};
