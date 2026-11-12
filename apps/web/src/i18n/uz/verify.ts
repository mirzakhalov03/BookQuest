import type { verify as En } from '../en/verify';

export const verify: typeof En = {
  promptTitle: 'Sertifikatni tekshirish',
  promptBody: 'QR kod yonida yozilgan kodni kiriting.',
  badCodeTitle: 'Bu sertifikat kodi emas',
  checkAgain: 'Tekshirib, qayta urining.',
  loading: 'Sertifikat tekshirilmoqda…',
  notFoundTitle: 'Bu kodli sertifikat yo‘q',
  notFoundBody: (code) => `${code} topilmadi. Tekshirib, qayta urining.`,
  codeShape: 'Kod BQ4-K7M2QX ko‘rinishida bo‘ladi.',
  codeLabel: 'Sertifikat kodi',
  check: 'Tekshirish',
  name: 'Ism',
  edition: 'Mavsum',
  book: 'Kitob',
  bookBy: (title, author) => `${author}, «${title}»`,
  place: 'O‘rin',
  participant: 'Ishtirokchi',
  issued: 'Berilgan sana',
  code: 'Kod',
  genuine: 'Haqiqiy BookQuest sertifikati',
  imageAlt: (name, year) => `${name} sertifikati, BookQuest ${year}`
};
