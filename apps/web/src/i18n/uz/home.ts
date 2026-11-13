import type { home as En } from '../en/home';

export const home: typeof En = {
  winPrize: (prize) => `${prize} yutib oling`,
  morePrizes: (n) => `yana ${n} ta sovrin`,
  revealedSoon: 'Tez orada ochiladi',
  loading: 'Sahna hozirlanmoqda…',
  bookAria: (title, author) => `${author}, «${title}» — yoritilgan sahnada`,
  countdown: {
    upcoming: 'O‘qish boshlanishiga',
    reading: 'O‘qish muddati tugashiga',
    quiz: 'Test yopilishiga',
    finished: 'Test yopildi'
  },
  resultsPublished: (date) => `Natijalar: ${date}`,
  factPages: 'Sahifa',
  factQuizOpens: 'Test ochiladi',
  factReaders: 'Ishtirokchilar',
  viewResults: 'Natijalarni ko‘rish',
  certificatesOnTheWay: 'Testni yakunlagan har bir kishiga sertifikat yuborilmoqda',
  enterQuiz: 'Testga kirish',
  goToBook: 'Kitobga o‘tish',
  youAreParticipant: (n) => `Siz ${n}-ishtirokchisiz`,
  registrationClosed: 'Ro‘yxatdan o‘tish yopildi',
  registrationClosedSub: 'O‘qish davri tugashi bilan ro‘yxatdan o‘tish yopildi',
  join: 'BookQuestga qo‘shilish',
  joinSub: 'Ro‘yxatdan o‘tish o‘qish davri tugaguncha davom etadi',
  speedCounts: 'Tezlik ham aniqlik kabi muhim.',
  quizSummary: (questions, minutes) => `${questions} · taxminan ${minutes} daqiqa`
};
