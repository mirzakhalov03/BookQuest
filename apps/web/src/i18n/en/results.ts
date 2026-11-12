import { pluralEn } from '../plural';

export const results = {
  label: 'Results',
  loading: 'Tallying the scores…',
  nobodyTitle: 'No one finished the quiz',
  nobodyBody: 'The results are in, but nobody submitted an attempt this year.',
  published: (date: string) => `Published ${date}`,
  fullLeaderboard: 'Full leaderboard',
  nothingTitle: 'Nothing to publish yet',
  nothingBody: "There's no quest running between editions. Check back once the next one opens.",
  notYetTitle: 'Not published yet',
  publishedIn: 'Results published in',
  publishedOn: (date: string) => `Results are published on ${date}`,
  finishedPrompt: (count: number, n: string) =>
    `${n} ${pluralEn(count, 'reader', 'readers')} finished the quiz. Sign in to see the full leaderboard and your rank.`,
  reviewYourAnswers: 'Review your answers'
};
