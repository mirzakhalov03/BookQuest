import type { registration as En } from '../en/registration';
import { ordinalWordRu } from './ordinal';

export const registration: typeof En = {
  editionLine: (edition) => `${ordinalWordRu(edition)} ежегодный читательский конкурс`,
  youreIn: 'Вы в игре!',
  yourNumber: 'Ваш номер участника',
  numberAria: (n) => `Номер участника ${n}`,
  keepNumber: 'Сохраните этот номер. По нему вас узнают в рейтинге, в бланке теста и на сертификате.',
  seeProfile: 'Перейти в профиль',
  contactTelegram: 'Telegram',
  contactPhone: 'Телефон',
  telegramPlaceholder: '@username',
  howWeReachYou: 'Как с вами связаться',
  contactMethod: 'Способ связи',
  claiming: 'Занимаем ваше место…',
  claim: 'Занять место',
  numberNote: 'Ваш номер будет в рейтинге, в бланке теста и на сертификате.'
};
