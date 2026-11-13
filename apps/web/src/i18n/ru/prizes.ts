import type { prizes as En } from '../en/prizes';

export const prizes: typeof En = {
  prizesGiven: 'Вручённые призы: ',
  photoAlt: 'Все призы этого сезона вместе',
  label: 'Призы',
  backToPrizes: 'Назад к призам',
  badEditionTitle: 'Такого номера сезона нет',
  badEditionBody: 'Выберите сезон на странице призов.',
  editionLoading: 'Листаем страницы назад…',
  browseInstead: 'Все прошлые сезоны — на странице призов.',
  tookPart: (n) => `Участников: ${n}.`,
  dates: 'Даты',
  opened: 'Открытие',
  readingDeadline: 'Срок чтения',
  quiz: 'Тест',
  results: 'Итоги',
  loading: 'Начищаем кубки…',
  noQuestBody: 'Призы следующего сезона появятся здесь, когда он откроется.',
  upForWinners: 'Что ждёт победителей',
  notAnnounced: 'Призы этого сезона ещё не объявлены. Загляните позже.',
  previous: 'Прошлые сезоны',
  archiveLoading: 'Открываем архив…',
  archiveEmpty: 'Пока пусто. Книга и победитель каждого сезона появятся здесь после его завершения.',
  placeLabel: (place) => `${place}: `,
  toBeAnnounced: 'Скоро объявим',
  wonBy: (name, n) => `победитель: ${name} (#${n})`
};
