import { pluralEn } from '../plural';
import { ordinalEn, ordinalWordEn } from './ordinal';

export const common = {
  appTagline: 'One book. One deadline. One quiz.',
  tryAgain: 'Try again',
  backToStart: 'Back to start',
  somethingWentWrong: 'Something went wrong',
  loading: 'Loading…',
  loadMore: 'Load more',
  close: 'Close',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  continue: 'Continue',
  back: 'Back',
  signIn: 'Sign in',
  logIn: 'Log in',
  logOut: 'Log out',
  checking: 'Checking…',
  more: 'more',
  less: 'less',
  pages: (count: number, n: string) => `${n} ${pluralEn(count, 'page', 'pages')}`,
  readers: (count: number, n: string) => `${n} ${pluralEn(count, 'reader', 'readers')}`,
  questions: (count: number, n: string) => `${n} ${pluralEn(count, 'question', 'questions')}`,
  participantAria: (n: number) => `Participant ${n}`,
  bookCoverAlt: (title: string) => `${title} cover`,
  editionYear: (edition: number, year: number) => `${ordinalWordEn(edition)} edition · ${year}`,
  editionShort: (edition: number, year: number) => `${ordinalWordEn(edition)} · ${year}`,
  place: (n: number) => `${ordinalEn(n)} place`,
  placeShort: (n: number) => ordinalEn(n),
  checkBackNextEdition: 'Check back once the next edition opens.',
  noQuest: 'No quest is running right now'
};
