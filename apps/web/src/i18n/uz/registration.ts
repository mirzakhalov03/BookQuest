import type { registration as En } from '../en/registration';
import { ordinalWordUz } from './ordinal';

export const registration: typeof En = {
  editionLine: (edition) => `${ordinalWordUz(edition)} an’anaviy kitobxonlik tanlovi`,
  youreIn: 'Siz safimizdasiz!',
  yourNumber: 'Ishtirokchi raqamingiz',
  numberAria: (n) => `Ishtirokchi raqami ${n}`,
  keepNumber: 'Bu raqamni saqlab qo‘ying. U sizni reytingda, test varaqangizda va sertifikatingizda ifodalaydi.',
  seeProfile: 'Profilga o‘tish',
  contactTelegram: 'Telegram',
  contactPhone: 'Telefon',
  telegramPlaceholder: '@username',
  howWeReachYou: 'Siz bilan bog‘lanish',
  contactMethod: 'Aloqa usuli',
  claiming: 'O‘rningiz band qilinmoqda…',
  claim: 'O‘rnimni band qilish',
  numberNote: 'Raqamingiz reytingda, test varaqangizda va sertifikatingizda ko‘rsatiladi.'
};
