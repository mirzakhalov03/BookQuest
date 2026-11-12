import type { results as En } from '../en/results';
import { pluralRu } from '../plural';

export const results: typeof En = {
  label: 'Итоги',
  loading: 'Подсчитываем баллы…',
  nobodyTitle: 'Тест никто не прошёл',
  nobodyBody: 'Итоги подведены, но в этом году никто не отправил ответы.',
  published: (date) => `Опубликовано ${date}`,
  fullLeaderboard: 'Полный рейтинг',
  nothingTitle: 'Пока нечего публиковать',
  nothingBody: 'Между сезонами конкурс не проводится. Загляните, когда откроется следующий.',
  notYetTitle: 'Ещё не опубликованы',
  publishedIn: 'До публикации итогов',
  publishedOn: (date) => `Итоги будут опубликованы ${date}`,
  // The verb agrees with the count: «прошёл 21 читатель», «прошли 3 читателя».
  finishedPrompt: (count, n) =>
    `Тест ${pluralRu(count, 'прошёл', 'прошли', 'прошли')} ${n} ${pluralRu(count, 'читатель', 'читателя', 'читателей')}. Войдите, чтобы увидеть полный рейтинг и своё место.`,
  reviewYourAnswers: 'Посмотреть свои ответы'
};
