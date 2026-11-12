import type { verify as En } from '../en/verify';

export const verify: typeof En = {
  promptTitle: 'Проверка сертификата',
  promptBody: 'Введите код, напечатанный рядом с QR-кодом.',
  badCodeTitle: 'Это не код сертификата',
  checkAgain: 'Проверьте его и попробуйте снова.',
  loading: 'Проверяем сертификат…',
  notFoundTitle: 'Сертификата с таким кодом нет',
  notFoundBody: (code) => `Код ${code} не найден. Проверьте его и попробуйте снова.`,
  codeShape: 'Код выглядит так: BQ4-K7M2QX.',
  codeLabel: 'Код сертификата',
  check: 'Проверить',
  name: 'Имя',
  edition: 'Сезон',
  book: 'Книга',
  bookBy: (title, author) => `«${title}», ${author}`,
  place: 'Место',
  participant: 'Участник',
  issued: 'Выдан',
  code: 'Код',
  genuine: 'Подлинный сертификат BookQuest',
  imageAlt: (name, year) => `Сертификат: ${name}, BookQuest ${year}`
};
