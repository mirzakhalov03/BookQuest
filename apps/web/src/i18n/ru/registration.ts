import type { registration as En } from '../en/registration';
import { ordinalWordRu } from './ordinal';

export const registration: typeof En = {
  editionLine: (edition) => `${ordinalWordRu(edition)} ежегодный читательский конкурс`,
  youreIn: 'Вы в игре!',
  yourNumber: 'Ваш номер участника',
  numberAria: (n) => `Номер участника ${n}`,
  keepNumber: 'Сохраните этот номер. По нему вас узнают в рейтинге, в бланке теста и на сертификате.',
  seeProfile: 'Перейти в профиль',
  meetMascot: 'А это ваш талисман',
  contactTelegram: 'Telegram',
  contactPhone: 'Телефон',
  telegramPlaceholder: '@username',
  howWeReachYou: 'Как с вами связаться',
  contactMethod: 'Способ связи',
  claiming: 'Регистрируем…',
  claim: 'Зарегистрироваться',
  whyAsk: 'Зачем мы спрашиваем',
  whyName: 'Чтобы убедиться, что участвует реальный человек. Позже мы можем использовать его, чтобы подтверждать вход.',
  whyContact: 'Чтобы связаться с вами и вручить приз, если вы победите.',
  numberNote: 'Ваш номер будет в рейтинге, в бланке теста и на сертификате.',
  alreadyJoinedTitle: 'Вы уже участвуете через Telegram',
  alreadyJoinedBody: (handle: string) => `${handle} уже участвует через Telegram. Войдите по коду из Telegram, чтобы сохранить один номер.`,
  signInInstead: 'Войти через Telegram',
  notYou: 'Это не вы? Продолжить'
};
