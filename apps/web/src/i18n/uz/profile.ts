import type { profile as En } from '../en/profile';

export const profile: typeof En = {
  meetMascot: 'Bu sizning maskotingiz! Almashtirish uchun bosing',
  loading: 'Raqamingiz qidirilmoqda…',
  readerFallback: 'Kitobxon',
  registrationClosed: 'Bu mavsum uchun ro‘yxatdan o‘tish yopildi. Keyingi mavsumda ko‘rishguncha!',
  nextEditionSoon: 'Keyingi mavsum tez orada boshlanadi.',
  adminDashboard: 'Admin paneli',
  certificates: 'Sertifikatlar va mukofotlar',
  certificateSlot: 'Sertifikatingiz shu yerda paydo bo‘ladi',
  certificateHint: 'Testni yakunlang — natijalar e’lon qilingach, u shu yerda chiqadi.',
  pickAvatar: 'Avatar tanlang',
  initials: 'Bosh harflar',
  avatars: {
    rabbit: 'Quyoncha',
    bear: 'Ayiq',
    queen: 'Malika',
    'cool-duck': 'Zo‘r o‘rdak',
    'arctic-fox': 'Qutb tulkisi',
    duck: 'O‘rdak',
    'arctic-hare': 'Qutb quyoni',
    'baby-penguin': 'Pingvincha'
  },
  changeAvatar: 'Avatarni o‘zgartirish',
  participantNumber: 'Ishtirokchi raqami',
  numberHint: 'Reytingda va sertifikatingizda',
  shareTitle: 'Mening BookQuest sertifikatim',
  linkCopied: 'Tasdiqlash havolasi nusxalandi.',
  certificateAlt: (name, year, place) => `${name} sertifikati, BookQuest ${year}${place ? `, ${place}` : ''}`,
  download: 'Yuklab olish',
  share: 'Ulashish',
  connectTelegram: 'Telegramni ulash',
  connectTelegramBody: 'Keyingi safar tezroq kirish uchun Telegram hisobingizni ulang.',
  connecting: 'Ulanmoqda…',
  connectFailed: 'Telegram sizni tasdiqladi, lekin ulab bo‘lmadi. Qayta urining.',
  language: 'Til',
  avatarFailed: 'Avatarni saqlab bo‘lmadi. Qayta urining.'
};
