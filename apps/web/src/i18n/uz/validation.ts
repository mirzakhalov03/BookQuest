import type { validation as En } from '../en/validation';

export const validation: typeof En = {
  fullName: {
    missing: 'Ismingiz sertifikatga yoziladi — shu yerga kiriting.',
    digits: 'Ismda raqam bo‘lmaydi.',
    characters: 'Faqat harflar, chiziqcha va apostrof.',
    one_word: 'Ism va familiyangizni kiriting.',
    too_many_words: 'Ism va familiya yetarli — ikki so‘z.',
    too_short: 'Ism ham, familiya ham kamida ikki harfdan iborat bo‘lsin.',
    not_a_name: 'Bu ismga o‘xshamayapti. Haqiqiy ismingizni kiriting.'
  },
  contact: {
    telegram_missing: 'Telegramdagi foydalanuvchi nomingizni kiriting.',
    telegram_short: 'Telegram foydalanuvchi nomi kamida 5 belgidan iborat.',
    telegram_long: 'Telegram foydalanuvchi nomi bunchalik uzun bo‘lmaydi.',
    telegram_format: 'Faqat lotin harflari, raqamlar va pastki chiziq; harf bilan boshlanadi.',
    phone_missing: 'Siz bilan bog‘lanish uchun raqam kiriting.',
    phone_short: 'Raqam to‘liq emasga o‘xshaydi.',
    phone_long: 'Raqamda ortiqcha raqamlar bor.'
  }
};
