import type { home as En } from '../en/home';
import { pluralRu } from '../plural';

export const home: typeof En = {
  revealedSoon: 'Скоро откроем',
  loading: 'Готовим сцену…',
  bookAria: (title, author) => `«${title}», ${author}, на освещённом пьедестале`,
  countdown: {
    upcoming: 'До начала чтения',
    reading: 'До конца чтения',
    quiz: 'До закрытия теста',
    finished: 'Тест закрыт'
  },
  resultsPublished: (date) => `Итоги: ${date}`,
  factPages: 'Страниц',
  factQuizOpens: 'Тест откроется',
  factReaders: 'Участников',
  viewResults: 'Смотреть итоги',
  certificatesOnTheWay: 'Сертификаты уже в пути ко всем, кто прошёл тест',
  enterQuiz: 'Перейти к тесту',
  goToBook: 'К книге',
  youAreParticipant: (n) => `Вы участник №${n}`,
  registrationClosed: 'Регистрация закрыта',
  registrationClosedSub: 'Регистрация закрылась вместе с периодом чтения',
  join: 'Участвовать в BookQuest',
  joinSub: 'Регистрация открыта до конца периода чтения',
  speedCounts: 'Скорость важна не меньше точности.',
  // Genitive after «около»: около 1 минуты, около 3 минут, около 5 минут.
  quizSummary: (questions, minutes) => `${questions} · около ${minutes} ${pluralRu(minutes, 'минуты', 'минут', 'минут')}`
};
