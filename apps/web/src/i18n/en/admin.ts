import type { Interaction, InteractionKind, QuestDateField, QuestPhase } from '@bookquest/shared';
import { pluralEn } from '../plural';

type MediaType = NonNullable<Interaction['media']>['type'];
type RangePreset = 'today' | '7d' | '30d' | 'all';

export const admin = {
  refresh: 'Refresh',
  admin: 'Admin',
  sections: 'Admin sections',
  backToStage: 'Back to the stage',
  tabs: {
    certificates: 'Certificates',
    dashboard: 'Dashboard',
    participants: 'Participants',
    quest: 'Quest',
    quizzes: 'Quizzes',
    results: 'Results',
    broadcast: 'Broadcast',
    messages: 'Messages',
    more: 'More'
  },
  notAdminTitle: 'This account is not an admin',
  copied: 'Copied.',
  copyFailed: "Couldn't copy. Long-press to select it.",
  copyValue: (value: string) => `Copy ${value}`,
  telegram: 'Telegram',
  phone: 'Phone',
  discard: 'Discard',
  unsavedRegion: 'Unsaved changes',
  discardTitle: 'Discard your changes?',
  keepEditing: 'Keep editing',
  discardBody: "These edits aren't saved yet. Leaving now throws them away.",
  now: 'Now',
  phase: {
    upcoming: 'Upcoming',
    reading: 'Reading',
    quiz: 'Quiz open',
    finished: 'Finished'
  } satisfies Record<QuestPhase, string>,
  milestone: {
    opens: 'Opens',
    readingEnds: 'Reading ends',
    quizOpens: 'Quiz opens',
    quizCloses: 'Quiz closes',
    resultsPublished: 'Results published'
  },
  dates: {
    opensAt: 'Opens',
    readingDeadline: 'Reading deadline',
    quizOpensAt: 'Quiz opens',
    quizClosesAt: 'Quiz closes',
    resultsAt: 'Results published'
  } satisfies Record<QuestDateField, string>,
  gaps: {
    opensAt: 'Reading',
    readingDeadline: 'Break',
    quizOpensAt: 'Quiz',
    quizClosesAt: 'Until results'
  } satisfies Partial<Record<QuestDateField, string>>,
  gapNone: 'no gap',
  gapHours: (n: number) => `${n} h`,
  gapDays: (n: number) => `${n} ${pluralEn(n, 'day', 'days')}`,
  dashboard: {
    bookHidden: 'Book hidden',
    loading: 'Reading the register…',
    betweenEditions: "Nothing is running between editions. Set up the next one when you're ready.",
    startNext: 'Start next edition',
    statParticipants: 'Participants',
    statJoinedToday: 'Joined today',
    statSubmitted: 'Quiz submitted',
    statInProgress: 'Quiz in progress',
    quizOpen: (date: string) => `The quiz is open. Results go out ${date}.`,
    viewResults: 'View results',
    resultsWait: (date: string) => `Results go out ${date}. The next edition can start after that.`,
    quickActions: 'Quick actions',
    actionQuizzes: 'Quizzes',
    actionCertificates: 'Certificates'
  },
  participants: {
    title: 'Participants',
    searchAria: 'Search participants',
    searchPlaceholder: 'Name, number or contact',
    loading: 'Counting the roster…',
    noMatchTitle: 'No one matches that search',
    noMatchBody: 'Try a different name, number or contact.',
    noneTitle: 'No one has registered yet',
    found: (n: string) => `${n} found`,
    registered: (n: string) => `${n} registered`,
    showMore: (n: string) => `Show more · ${n} left`,
    sort: 'Sort',
    sortNumber: 'Number',
    sortName: 'Name',
    sortDate: 'Date',
    colNumber: 'Number',
    colName: 'Name',
    colContact: 'Contact',
    colRegistered: 'Registered'
  },
  broadcast: {
    sentToast: 'Broadcast on its way.',
    eyebrow: 'Broadcast',
    title: 'Message everyone',
    message: 'Message',
    placeholder: 'The quiz opens tomorrow at 18:00.',
    reach: (people: string, telegram: string) =>
      `Reaches ${people} people · ${telegram} on Telegram`,
    sendToEveryone: 'Send to everyone',
    confirmTitle: 'Send this to everyone?',
    sending: 'Sending…',
    sendNow: 'Send now',
    confirmBody: (people: string, telegram: string) =>
      `It reaches ${people} people in the app, ${telegram} of them on Telegram too. It can't be unsent.`,
    inTelegram: 'In Telegram',
    sent: 'Sent',
    outboxLoading: 'Opening the outbox…',
    nothingSent: 'Nothing sent yet.',
    onTelegram: (sent: string, total: string) => ` · ${sent} of ${total} on Telegram`,
    statusSending: (telegram: string) => `Sending${telegram}`,
    statusSent: (n: string, telegram: string) => `Reached ${n}${telegram}`,
    statusInterrupted: (telegram: string) => `Interrupted${telegram}`,
    suggestions: {
      announce: 'Announce the opening',
      announceText: (year: number, opens: string, title: string, author: string) =>
        `BookQuest ${year} opens on ${opens}. This year's book is ${title} by ${author}. Open BookQuest to join!`,
      quizDates: 'Quiz dates',
      quizDatesText: (opens: string, closes: string) =>
        `Mark your calendar: the quiz opens ${opens} and closes ${closes}. One attempt, so pick your moment!`,
      remind: 'Remind readers',
      remindText: (days: number, title: string, quizOpens: string) =>
        `${days < 1 ? 'Less than a day' : `${days} ${pluralEn(days, 'day', 'days')}`} left to finish ${title}. The quiz opens ${quizOpens}.`,
      quizOpen: 'Quiz is open',
      quizOpenText: (closes: string) => `The quiz is open until ${closes}. One attempt. Good luck!`,
      resultsDate: 'Results date',
      resultsDateText: (date: string) => `The quiz has closed. Results are published ${date}.`,
      resultsOut: 'Results are out',
      resultsOutText: (title: string) =>
        `Results for ${title} are out! Open BookQuest to see where you placed.`
    }
  },
  certificates: {
    loading: 'Laying out the certificates…',
    noQuest: "Create this year's quest first.",
    placeholderNote: 'Placeholder design: final artwork coming.',
    delivery: 'Sending',
    unlocksAt: (date: string) => `Sending unlocks when results are published, ${date}.`,
    readyToSend: 'Certificates are ready to send',
    title: 'Certificates',
    tiers: {
      gold: '1st place',
      silver: '2nd place',
      bronze: '3rd place',
      participant: 'Everyone else'
    },
    sampleAlt: (tier: string) => `Sample certificate: ${tier}`,
    sentToast: 'Certificates on their way.',
    startFailed: 'Could not start sending.',
    progressAria: 'Certificates sent',
    allSent: 'All certificates sent',
    sending: 'Sending…',
    send: 'Send certificates',
    confirmTitle: (n: string) => `Send to ${n} finishers?`,
    starting: 'Starting…',
    sendNow: 'Send now',
    confirmBody: (n: string) =>
      `${n} get it in Telegram, the rest in the app. Everyone can download it from their profile. It can’t be unsent.`,
    idle: (n: string) => `${n} finishers haven’t been sent their certificate yet.`,
    progress: (done: string, total: string) => `Sending… ${done} of ${total}`,
    summary: (delivered: string, inApp: string, blocked: string) =>
      `${delivered} delivered in Telegram · ${inApp} in-app only · ${blocked} blocked the bot`,
    failed: (n: string) => ` · ${n} failed, send again to retry`,
    interrupted: '. The last send was interrupted: press Send to finish it.'
  },
  messages: {
    title: 'Messages',
    newCount: (n: string) => `${n} new`,
    loading: 'Reading the inbox…',
    thisPerson: 'this person',
    rowsAria: 'Which rows',
    viewMessages: 'Messages',
    viewAll: 'Everything',
    searchAria: 'Search messages',
    searchPlaceholder: 'Name, @user, id or text',
    kind: 'Kind',
    allKinds: 'All kinds',
    command: 'Command',
    allCommands: 'All commands',
    broadcast: 'Broadcast',
    anyBroadcast: 'Any broadcast',
    when: 'When',
    order: 'Order',
    newest: 'Newest first',
    oldest: 'Oldest first',
    showOrganisers: 'Show organisers',
    stopOnly: (name: string) => `Stop showing only ${name}`,
    only: (name: string) => `Only ${name}`,
    range: {
      today: 'Today',
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      all: 'All time'
    } satisfies Record<RangePreset, string>,
    emptyTitle: (view: 'messages' | 'all', person: string | null, range: RangePreset) =>
      `No ${view === 'messages' ? 'messages' : 'activity'}${person ? ` from ${person}` : ''}${
        range === 'all'
          ? ''
          : ` ${({ today: 'today', '7d': 'in the last 7 days', '30d': 'in the last 30 days' } as const)[range]}`
      }`,
    narrowed: 'Search or filters are narrowing this down.',
    switchToAll: 'Switch to Everything to see /start taps and button presses too.',
    clearFilters: 'Clear filters',
    colTime: 'Time',
    colPerson: 'Person',
    colKind: 'Kind',
    colContent: 'Content',
    unknown: 'Unknown',
    copyIdOf: (name: string) => `Copy Telegram id of ${name}`,
    organiser: 'Organiser',
    loadingMore: 'Loading more…',
    person: 'Person',
    showInList: 'Show in list',
    personFailed: "Couldn't load this person. Close and try again.",
    personLoading: 'Opening their history…',
    copyId: 'Copy Telegram id',
    noUsername: 'No @username: a reply from the bot is the only way to reach them.',
    firstSeen: (date: string) => `First seen ${date}`,
    lastSeen: (ago: string) => ` · Last seen ${ago}`,
    interactions: (count: number, n: string) =>
      ` · ${n} ${pluralEn(count, 'interaction', 'interactions')}`,
    blockedBot: 'Blocked the bot',
    unblockedBot: 'Unblocked the bot',
    kinds: {
      text: 'Text',
      command: 'Command',
      button: 'Button',
      contact: 'Contact',
      media: 'Media',
      location: 'Location',
      web_app_data: 'App data',
      membership: 'Access',
      other: 'Other'
    } satisfies Record<InteractionKind, string>,
    media: {
      photo: 'Photo',
      voice: 'Voice message',
      video: 'Video',
      video_note: 'Video note',
      audio: 'Audio',
      document: 'File',
      sticker: 'Sticker',
      animation: 'GIF'
    } satisfies Record<MediaType, string>,
    seconds: (n: number) => `${n}s`,
    ownNumber: ' (own number)',
    otherUpdate: 'Other update',
    edited: '(edited)',
    replyingTo: (text: string) => `Replying to “${text}”`,
    afterBroadcast: (snippet: string) => `After broadcast “${snippet}”`
  }
};
