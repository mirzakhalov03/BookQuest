export const book = {
  cards: {
    heading: 'Where to get it',
    places: (n: number) => (n === 1 ? '1 place' : `${n} places`),
    empty: 'Not available yet',
    stepsHeading: 'How to get it',
    linksHeading: 'Links',
    ebook: {
      title: 'E-book',
      hint: 'Read on your phone or laptop',
      steps: ['Pick a format below: PDF opens anywhere, EPUB suits reader apps.', 'Open it in your browser or a reader app.', 'Bookmark where you stop so the quiz finds you ready.']
    },
    movie: {
      title: 'Movie',
      hint: 'Watch the adaptation',
      steps: ['Read the book first: the quiz is about the book, not the film.', 'Tap a link below and confirm to open YouTube.', 'Come back to BookQuest when you’re done.']
    },
    audio: {
      title: 'Audiobook',
      hint: 'Listen on the go',
      steps: ['Pick a recording below.', 'It opens in Telegram or your audio app.', 'Use 1.25× speed if you’re short on time.']
    },
    offline: {
      title: 'Buy offline',
      hint: 'HilolNashr partners and shops',
      steps: ['Choose a shop from the list below.', 'Ask for the book by its title and author.', 'Keep the receipt: some partners swap a damaged copy.']
    }
  },
  leavingTitle: 'Leaving BookQuest',
  leavingBody: 'This opens YouTube outside the app. You can come back any time.',
  openYoutube: 'Open YouTube',
  stay: 'Stay here',
  watch: 'Watch',
  mysteryLabel: 'A secret book, revealed soon',
  lockedTitle: 'The book is a secret, for now',
  lockedBody: "We'll reveal it soon. You'll get a notification.",
  loading: 'Opening the book…',
  about: 'About the book',
};
