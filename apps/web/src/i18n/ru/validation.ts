import type { validation as En } from '../en/validation';

export const validation: typeof En = {
  fullName: {
    missing: 'Ваше имя будет на сертификате — укажите его здесь.',
    digits: 'В имени не бывает цифр.',
    characters: 'Только буквы, дефисы и апострофы.',
    one_word: 'Введите имя и фамилию.',
    too_many_words: 'Достаточно имени и фамилии — двух слов.',
    too_short: 'И в имени, и в фамилии должно быть хотя бы две буквы.',
    not_a_name: 'Это не похоже на имя. Введите настоящее.'
  },
  contact: {
    telegram_missing: 'Укажите ваш username в Telegram.',
    telegram_short: 'Username в Telegram — минимум 5 символов.',
    telegram_long: 'Username в Telegram не бывает таким длинным.',
    telegram_format: 'Только латинские буквы, цифры и подчёркивание; начинается с буквы.',
    phone_missing: 'Укажите номер, по которому с вами можно связаться.',
    phone_short: 'В номере не хватает цифр.',
    phone_long: 'В номере лишние цифры.'
  }
};
