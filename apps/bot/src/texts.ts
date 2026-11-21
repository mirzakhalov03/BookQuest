/** Every word the bot says. Uzbek only by design; the Mini App owns multilingual. HTML where noted. */
export const TEXTS = {
  // HTML; the name arrives already escaped.
  welcome: (name: string) => `Assalomu alaykum, <b>${name}</b>! 👋 BookQuestga xush kelibsiz.`,

  // HTML; the poster's caption, so keep under 1024 chars.
  season: [
    '<b>📚 Book Quest 3.0</b> — 3-mavsum boshlandi!',
    '',
    'Kitob o‘qing va VR headset, smartwatch, powerbank, AirPods hamda Ibrat Academy Gold ' +
      'vaucherini yutib oling — yana ustiga istalgan kitobingizni tanlaysiz 🎁',
    '',
    '<blockquote><b>Shartlari oddiy:</b>',
    '1. Ro‘yxatdan o‘ting ✍️',
    '2. Kitobni tugating 📖',
    '3. Testda tez va yuqori ball oling 🏆</blockquote>',
    '',
    'Ro‘yxatdan o‘tish ham, test ham — hammasi bitta ilovada. Boshlash uchun quyidagi tugmani bosing 👇'
  ].join('\n'),

  guideButton: '🧭 Qanday ishtirok etaman?',
  // HTML.
  guide: [
    '<b>🧭 BookQuest’da qanday ishtirok etiladi</b>',
    '',
    '<b>1. Botni ishga tushiring.</b> @bookquest_bot ga kiring va /start buyrug‘ini bering.',
    '',
    '<b>2. Ilovani oching.</b> «📖 BookQuestni ochish» tugmasini bosing — mini-app shu yerning o‘zida ochiladi.',
    '',
    '<b>3. Ro‘yxatdan o‘ting.</b> «BookQuestga ro‘yxatdan o‘tish» tugmasini bosing, ism-familiyangiz va ' +
      'Telegram username yoki telefon raqamingizni kiriting. Shundan so‘ng ishtirokchi raqamingizni olasiz. ' +
      'Ro‘yxatdan o‘tish o‘qish muddati tugaguncha ochiq.',
    '',
    '<b>4. Kitobni o‘qing.</b> Ilovadagi «Kitob» bo‘limida kitob haqida ma’lumot, uni qayerdan ' +
      'xarid qilish mumkinligi, elektron shakli va YouTube’dagi videosiga havolalar bor.',
    '',
    '<b>5. Testni topshiring.</b> Test qachon ochilishi ilovaning bosh sahifasida ko‘rsatiladi. ' +
      'G‘oliblarni to‘g‘ri javoblar soni va tezlik belgilaydi ⏱',
    '',
    '<b>6. Natijalar.</b> G‘oliblar sovrinlarni oladi, testni yakunlagan har bir ishtirokchiga ' +
      'sertifikat beriladi 🎓',
    '',
    'Savollar bo‘lsa — «💬 Savol va takliflar» tugmasi orqali bizga yozing.'
  ].join('\n'),

  openApp: '📖 BookQuestni ochish',
  menuButton: 'Ochish',
  fallback: 'Hammasi endi ilova ichida.',
  fallbackWithFeedback:
    'Hammasi endi ilova ichida. Savolingiz bo‘lsa, «💬 Savol va takliflar» tugmasini bosing.',

  aboutButton: 'ℹ️ Biz haqimizda',

  // HTML; keep under 1024 chars so it stays the photo's caption.
  about: [
    '<b>📚 BookQuest</b> — 2024-yilda ikki kitobxon do‘st tomonidan asos solingan yillik kitobxonlik musobaqasi.',
    '',
    '🎯 Maqsad — kitob o‘qishga bo‘lgan qiziqishni kuchaytirish va o‘qish madaniyatini rivojlantirish.',
    '',
    '<b>Bizning jamoamiz:</b>',
    '<blockquote><b><a href="https://t.me/mirzakhalov03">Javohir Mirzakhalov</a></b> — Tashkilotchi',
    '<b><a href="https://t.me/vokhabov27">Abdulahad Vokhabov</a></b> — Tashkilotchi',
    '<b><a href="https://t.me/Ibn_Makhmood">Muzaffar Ortiqov</a></b> — Maslahatchi va homiy</blockquote>',
    '',
    '🤖 <a href="https://t.me/bookquest_bot">@bookquest_bot</a>'
  ].join('\n'),

  // Feedback chat — what the participant sees.
  feedbackButton: '💬 Savol va takliflar',
  feedbackExitButton: '⬅️ Orqaga',
  feedbackIntro:
    'Savolingiz, taklifingiz yoki biror xatoni payqagan bo‘lsangiz — shu yerga yozing. ' +
    'Xabaringizni tashkilotchilarga yetkazaman, javobni shu chatda olasiz.\n\n' +
    'Matn, rasm, video yoki ovozli xabar yuborishingiz mumkin. ' +
    'Tugatgach, «⬅️ Orqaga» tugmasini bosing.',
  feedbackClosed: 'Rahmat! Yana savol tug‘ilsa, «💬 Savol va takliflar» tugmasini bosing.',
  feedbackFailed: 'Xabarni yuborib bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.',
  // HTML.
  feedbackAnswerHeader: '💬 <b>BookQuest jamoasidan javob:</b>',

  // Feedback chat — what organizers see in the group. HTML.
  feedbackNewMessageHeader: '💬 <b>Foydalanuvchidan yangi xabar:</b>',
  groupReplyButton: '↩️ Javob berish',
  // Every prompt starts with it — how a prompt forgotten across a restart is still recognised.
  groupPromptMarker: '✍️',
  groupPrompt: (adminMention: string) =>
    `✍️ ${adminMention}, javobingizni shu xabarga javob (reply) qilib yozing.`,
  groupPromptExpired:
    '⌛ Bu so‘rov eskirgan — javob yuborilmadi. «↩️ Javob berish» tugmasini qayta bosing.',
  groupDeliveryFailed: '❌ Yetkazilmadi — foydalanuvchi botni bloklagan bo‘lishi mumkin.',
  groupChatId: (id: number) =>
    `Bu guruh ID raqami: <code>${id}</code>\n\nFikr-mulohazalar shu yerga kelishi uchun uni ` +
    '<code>ADMIN_CHAT_ID</code> sifatida sozlang.'
} as const;
