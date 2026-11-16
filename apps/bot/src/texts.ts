/** Every word the bot says. Uzbek only by design; the Mini App owns multilingual. HTML where noted. */
export const TEXTS = {
  welcome:
    'BookQuestga xush kelibsiz! 📚\n\n' +
    'Har yili o‘tkaziladigan kitobxonlik musobaqasi — kitobni tanlang, o‘qing, testni topshiring. ' +
    'G‘oliblarni tezlik va aniqlik belgilaydi, oxirigacha yetgan har bir ishtirokchi esa ' +
    'sertifikat oladi.',
  getStarted: 'Boshlash uchun quyidagi tugmani bosing.',
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
    '🌐 <a href="https://bookquest.uz">bookquest.uz</a>'
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
