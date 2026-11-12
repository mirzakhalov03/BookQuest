import type { results as En } from '../en/results';

export const results: typeof En = {
  label: 'Natijalar',
  loading: 'Ballar hisoblanmoqda…',
  nobodyTitle: 'Testni hech kim yakunlamadi',
  nobodyBody: 'Natijalar tayyor, lekin bu yil hech kim javob yubormadi.',
  published: (date) => `E’lon qilingan: ${date}`,
  fullLeaderboard: 'To‘liq reyting',
  nothingTitle: 'Hozircha e’lon qilinadigan narsa yo‘q',
  nothingBody: 'Mavsumlar orasida tanlov o‘tkazilmaydi. Keyingisi boshlanganda qaytib keling.',
  notYetTitle: 'Hali e’lon qilinmagan',
  publishedIn: 'Natijalar e’lon qilinishiga',
  publishedOn: (date) => `Natijalar e’lon qilinadi: ${date}`,
  finishedPrompt: (_count, n) =>
    `${n} kitobxon testni yakunladi. To‘liq reyting va o‘rningizni ko‘rish uchun kiring.`,
  reviewYourAnswers: 'Javoblaringizni ko‘rish'
};
