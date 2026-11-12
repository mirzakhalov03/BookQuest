import type { prizes as En } from '../en/prizes';

export const prizes: typeof En = {
  label: 'Sovrinlar',
  backToPrizes: 'Sovrinlarga qaytish',
  badEditionTitle: 'Bunday mavsum raqami yo‘q',
  badEditionBody: 'Mavsumni sovrinlar sahifasidan tanlang.',
  editionLoading: 'Sahifalar varaqlanmoqda…',
  browseInstead: 'Barcha o‘tgan mavsumlarni sovrinlar sahifasida ko‘ring.',
  tookPart: (n) => `${n} kishi qatnashdi.`,
  dates: 'Sanalar',
  opened: 'Boshlangan',
  readingDeadline: 'O‘qish muddati',
  quiz: 'Test',
  results: 'Natijalar',
  loading: 'Kuboklar yaltiratilmoqda…',
  noQuestBody: 'Keyingi mavsum sovrinlari u boshlanganda shu yerda paydo bo‘ladi.',
  upForWinners: 'G‘oliblarni nima kutmoqda',
  notAnnounced: 'Bu mavsum sovrinlari hali e’lon qilinmagan. Tez orada qaytib keling.',
  previous: 'O‘tgan mavsumlar',
  archiveLoading: 'Arxiv ochilmoqda…',
  archiveEmpty: 'Hozircha bo‘sh. Har bir mavsumning kitobi va g‘olibi u yakunlangach shu yerda paydo bo‘ladi.',
  placeLabel: (place) => `${place}: `,
  toBeAnnounced: 'Tez orada e’lon qilinadi',
  wonBy: (name, n) => `g‘olib: ${name} (#${n})`
};
