import type { profile as En } from '../en/profile';

export const profile: typeof En = {
  loading: 'Ищем ваш номер…',
  readerFallback: 'Читатель',
  registrationClosed: 'Регистрация в этом сезоне закрыта. До встречи в следующем!',
  nextEditionSoon: 'Следующий сезон скоро откроется.',
  adminDashboard: 'Панель администратора',
  certificates: 'Сертификаты и награды',
  certificateSlot: 'Здесь появится ваш сертификат',
  certificateHint: 'Пройдите тест — сертификат появится после публикации итогов.',
  pickAvatar: 'Выберите аватар',
  initials: 'Инициалы',
  avatars: {
    rabbit: 'Кролик',
    bear: 'Медведь',
    chick: 'Цыплёнок',
    queen: 'Королева',
    'cool-duck': 'Крутая утка',
    'arctic-fox': 'Полярная лиса',
    duck: 'Утка',
    'arctic-hare': 'Полярный заяц',
    'baby-penguin': 'Пингвинёнок'
  },
  changeAvatar: 'Сменить аватар',
  participantNumber: 'Номер участника',
  numberHint: 'В рейтинге и на сертификате',
  shareTitle: 'Мой сертификат BookQuest',
  linkCopied: 'Ссылка для проверки скопирована.',
  certificateAlt: (name, year, place) => `Сертификат: ${name}, BookQuest ${year}${place ? `, ${place}` : ''}`,
  download: 'Скачать',
  share: 'Поделиться',
  connectTelegram: 'Привязать Telegram',
  connectTelegramBody: 'Привяжите Telegram, чтобы в следующий раз входить быстрее.',
  connecting: 'Привязываем…',
  connectFailed: 'Telegram подтвердил вас, но привязать не удалось. Попробуйте ещё раз.',
  language: 'Язык',
  avatarFailed: 'Не удалось сохранить аватар. Попробуйте ещё раз.'
};
