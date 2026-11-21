import type { registration as En } from '../en/registration';
import { ordinalWordUz } from './ordinal';

export const registration: typeof En = {
  editionLine: (edition) => `${ordinalWordUz(edition)} an’anaviy kitobxonlik tanlovi`,
  youreIn: 'Siz safimizdasiz!',
  yourNumber: 'Ishtirokchi raqamingiz',
  numberAria: (n) => `Ishtirokchi raqami ${n}`,
  keepNumber: 'Bu raqamni saqlab qo‘ying. U sizni reytingda, test varaqangizda va sertifikatingizda ifodalaydi.',
  seeProfile: 'Profilga o‘tish',
  meetMascot: 'Bu esa sizning maskotingiz',
  contactTelegram: 'Telegram',
  contactPhone: 'Telefon',
  telegramPlaceholder: '@username',
  howWeReachYou: 'Siz bilan bog‘lanish',
  contactMethod: 'Aloqa usuli',
  claiming: 'Ro‘yxatdan o‘tilmoqda…',
  claim: 'Ro‘yxatdan o‘tish',
  whyAsk: 'Nega so‘raymiz',
  whyName: 'Tanlovda haqiqiy insonlar qatnashayotganiga ishonch hosil qilish uchun. Keyinchalik kirishda shaxsingizni tasdiqlash uchun ham ishlatishimiz mumkin.',
  whyContact: 'G‘olib bo‘lsangiz, sovringizni topshirish uchun siz bilan bog‘lana olishimiz kerak.',
  numberNote: 'Raqamingiz reytingda, test varaqangizda va sertifikatingizda ko‘rsatiladi.',
  alreadyJoinedTitle: 'Siz Telegram orqali allaqachon qo‘shilgansiz',
  alreadyJoinedBody: (handle: string) => `${handle} bu tanlovda Telegram orqali ishtirok etmoqda. Bitta raqam saqlanishi uchun Telegram kodi orqali kiring.`,
  signInInstead: 'Telegram orqali kirish',
  notYou: 'Bu siz emasmi? Davom etish'
};
