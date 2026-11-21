import type { book as En } from '../en/book';

export const book: typeof En = {
  cards: {
    heading: 'Qayerdan topish mumkin',
    places: (n: number) => `${n} ta manba`,
    empty: 'Hozircha mavjud emas',
    stepsHeading: 'Qanday topiladi',
    linksHeading: 'Havolalar',
    ebook: {
      title: 'Elektron kitob',
      hint: 'Hilol eBook ilovasida bepul',
      steps: ['App Store yoki Play Market’dan «Hilol eBook» ilovasini yuklab oling va o‘rnating.', 'Ilova ichida kitob nomini qidiring.', 'Kitobni bepul oling va o‘qing.']
    },
    movie: {
      title: 'Film',
      hint: 'Ekranlashtirilgan variantini ko‘ring',
      steps: ['Avval kitobni o‘qing: test film emas, kitob bo‘yicha.', 'Quyidagi havolani bosing va YouTube’ni ochishni tasdiqlang.', 'Tugatgach, BookQuest’ga qayting.']
    },
    audio: {
      title: 'Audiokitob',
      hint: 'Yo‘lda tinglang',
      steps: ['Quyidan yozuvni tanlang.', 'U Telegram yoki audio ilovangizda ochiladi.', 'Vaqtingiz kam bo‘lsa, 1.25× tezlikda tinglang.']
    },
    offline: {
      title: 'Do‘kondan sotib olish',
      hint: 'HilolNashr hamkorlari va do‘konlari',
      steps: ['Quyidagi ro‘yxatdan do‘konni tanlang.', 'Kitobni nomi va muallifi bo‘yicha so‘rang.', 'Chekni saqlab qo‘ying: ba’zi hamkorlar nuqsonli nusxani almashtirib beradi.']
    }
  },
  leavingTitle: 'BookQuest’dan chiqish',
  leavingBody: 'YouTube ilovadan tashqarida ochiladi. Istalgan vaqtda qaytishingiz mumkin.',
  openYoutube: 'YouTube’ni ochish',
  stay: 'Shu yerda qolish',
  watch: 'Ko‘rish',
  mysteryLabel: 'Sirli kitob — tez orada ochiladi',
  lockedTitle: 'Kitob hozircha sir',
  lockedBody: 'Tez orada ochamiz. Sizga xabar yuboramiz.',
  loading: 'Kitob ochilmoqda…',
  about: 'Kitob haqida',
};
