import type { common as En } from '../en/common';
import { pluralRu } from '../plural';

export const common: typeof En = {
  appTagline: 'Одна книга. Один срок. Один тест.',
  tryAgain: 'Повторить',
  backToStart: 'На главную',
  somethingWentWrong: 'Что-то пошло не так',
  loading: 'Загрузка…',
  loadMore: 'Показать ещё',
  close: 'Закрыть',
  cancel: 'Отмена',
  save: 'Сохранить',
  saving: 'Сохраняем…',
  continue: 'Продолжить',
  back: 'Назад',
  signIn: 'Войти',
  logIn: 'Войти',
  logOut: 'Выйти',
  checking: 'Проверяем…',
  more: 'ещё',
  less: 'свернуть',
  pages: (count, n) => `${n} ${pluralRu(count, 'страница', 'страницы', 'страниц')}`,
  readers: (count, n) => `${n} ${pluralRu(count, 'читатель', 'читателя', 'читателей')}`,
  questions: (count, n) => `${n} ${pluralRu(count, 'вопрос', 'вопроса', 'вопросов')}`,
  participantAria: (n) => `Участник №${n}`,
  bookCoverAlt: (title) => `Обложка книги «${title}»`,
  editionYear: (edition, year) => `${edition}-й сезон · ${year}`,
  editionShort: (edition, year) => `${edition}-й сезон · ${year}`,
  place: (n) => `${n}-е место`,
  placeShort: (n) => `${n}-е место`,
  checkBackNextEdition: 'Загляните, когда откроется следующий сезон.',
  noQuest: 'Сейчас конкурс не проводится'
};
