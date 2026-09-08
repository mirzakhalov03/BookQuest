/* ============================================================
   BookQuest — mock data and app configuration
   Everything here is stand-in content. Structured as a single
   object so a real API response can replace it wholesale.
   ============================================================ */

window.BQ = window.BQ || {};

BQ.data = {
  quest: {
    edition: 'IV',
    year: 2026,
    readingDeadline: new Date(2026, 8, 20, 23, 59, 0),  // 20 Sep 2026, 23:59
    quizOpens:       new Date(2026, 8, 21, 18, 0, 0),
    quizCloses:      new Date(2026, 8, 21, 20, 0, 0),
    resultsAt:       new Date(2026, 8, 22, 12, 0, 0),
    readers: 1204
  },

  book: {
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    pages: 197
  },

  participant: {
    id: 3047
  }
};

/* Copy for every state the Home page can be in.
   The countdown, its label and the action all move together. */
BQ.states = {
  unregistered: {
    clockLabel: 'Reading deadline',
    target: 'readingDeadline',
    cta: 'Join BookQuest',
    sub: 'Registration closes when the reading period ends',
    gold: false
  },
  reading: {
    clockLabel: 'Reading deadline',
    target: 'readingDeadline',
    cta: 'Go to the book',
    sub: null,                       // filled with the participant number
    gold: false
  },
  quiz: {
    clockLabel: 'Quiz closes in',
    target: 'quizCloses',
    cta: 'Enter the quiz',
    sub: '20 questions. Speed counts as much as accuracy.',
    gold: false
  },
  finished: {
    clockLabel: 'Quiz closed',
    target: null,                    // frozen
    cta: 'View results',
    sub: 'Certificates are on their way to everyone who finished',
    gold: true
  }
};

BQ.format = {
  longDate: function (d) {
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December'];
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ', ' + hh + ':' + mm;
  }
};
