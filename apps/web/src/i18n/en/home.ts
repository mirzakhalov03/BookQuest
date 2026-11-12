export const home = {
  loading: 'Setting the stage…',
  bookAria: (title: string, author: string) => `${title} by ${author}, standing on a lit podium`,
  countdown: {
    upcoming: 'Reading opens in',
    reading: 'Reading deadline',
    quiz: 'Quiz closes in',
    finished: 'Quiz closed'
  },
  resultsPublished: (date: string) => `Results published ${date}`,
  factPages: 'Pages',
  factQuizOpens: 'Quiz opens',
  factReaders: 'Readers in',
  viewResults: 'View results',
  certificatesOnTheWay: 'Certificates are on their way to everyone who finished',
  enterQuiz: 'Enter the quiz',
  goToBook: 'Go to the book',
  youAreParticipant: (n: string) => `You're participant ${n}`,
  registrationClosed: 'Registration has closed',
  registrationClosedSub: 'Registration closed when the reading period ended',
  join: 'Join BookQuest',
  joinSub: 'Registration closes when the reading period ends',
  speedCounts: 'Speed counts as much as accuracy.',
  quizSummary: (questions: string, minutes: number) => `${questions} · about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
};
