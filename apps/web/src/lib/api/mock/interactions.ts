import { INTERACTION_KINDS } from '@bookquest/shared';
import type {
  Interaction,
  InteractionFacets,
  InteractionKind,
  InteractionList,
  PersonSummary
} from '@bookquest/shared';

/**
 * The bot inbox, served from fixtures. Module memory, not sessionStorage: a
 * reload regenerates the same rows around "now", and `addMessage` (a mock
 * control) can append without a reload so the "N new" pill can be seen.
 */

const MINUTE = 60_000;
const ADMIN_ID = '100';

interface Person {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
}

const PEOPLE: Person[] = [
  { id: '512340001', firstName: 'Aziza', lastName: 'Karimova', username: 'aziza_k' },
  { id: '771200002', firstName: 'Bekzod', lastName: 'Tursunov', username: null },
  { id: '640900003', firstName: 'Madina', lastName: null, username: 'madina_reads' },
  { id: '905500004', firstName: 'Javlon', lastName: 'Rahimov', username: 'javlon' },
  { id: ADMIN_ID, firstName: 'Organiser', lastName: null, username: 'bq_admin' }
];

const BROADCAST = {
  id: 'b'.repeat(24),
  snippet: 'Yangi kitob e’lon qilindi! Ro‘yxatdan o‘tish ochiq — ilovada…'
};

type Draft = Partial<Interaction> & { kind: InteractionKind };

function row(index: number, person: Person, minutesAgo: number, draft: Draft): Interaction {
  const signal =
    !!draft.inReplyTo ||
    ['text', 'contact', 'media', 'location', 'web_app_data'].includes(draft.kind) ||
    (draft.kind === 'command' && (draft.command !== 'start' || !!draft.commandArgs));
  return {
    id: index.toString(16).padStart(24, '0'),
    signal,
    isEdit: false,
    telegramUserId: person.id,
    userId: null,
    from: { firstName: person.firstName, lastName: person.lastName, username: person.username },
    fromAdmin: person.id === ADMIN_ID,
    text: null,
    command: null,
    commandArgs: null,
    buttonLabel: null,
    callbackData: null,
    contact: null,
    media: null,
    location: null,
    membership: null,
    inReplyTo: null,
    broadcast: null,
    sentAt: new Date(Date.now() - minutesAgo * MINUTE).toISOString(),
    ...draft
  };
}

function buildRows(): Interaction[] {
  const [aziza, bekzod, madina, javlon, admin] = PEOPLE as [Person, Person, Person, Person, Person];
  const drafts: [Person, number, Draft][] = [
    [aziza, 2, { kind: 'text', text: 'Kitob qachon chiqadi?', broadcast: BROADCAST }],
    [
      bekzod,
      6,
      {
        kind: 'contact',
        contact: { phoneNumber: '+998901234512', firstName: 'Bekzod', isOwn: true }
      }
    ],
    [madina, 14, { kind: 'command', command: 'start' }],
    [
      javlon,
      25,
      {
        kind: 'text',
        text: 'Rahmat! <b>Zo‘r</b> https://example.com',
        inReplyTo: { messageId: 4, text: 'Tap below to get started.' }
      }
    ],
    [
      aziza,
      40,
      {
        kind: 'media',
        media: { type: 'photo', mimeType: null, fileName: null, durationSec: null, emoji: null },
        text: 'Bu muqova to‘g‘rimi?'
      }
    ],
    [
      madina,
      55,
      {
        kind: 'media',
        media: {
          type: 'voice',
          mimeType: 'audio/ogg',
          fileName: null,
          durationSec: 12,
          emoji: null
        }
      }
    ],
    [admin, 70, { kind: 'text', text: 'test' }],
    [bekzod, 90, { kind: 'command', command: 'start', commandArgs: 'ref_school12' }],
    [javlon, 130, { kind: 'membership', membership: 'blocked' }],
    [javlon, 135, { kind: 'membership', membership: 'unblocked' }],
    [madina, 200, { kind: 'location', location: { lat: 41.2995, lng: 69.2401 } }],
    [aziza, 260, { kind: 'button', buttonLabel: 'Join now', callbackData: 'join' }],
    [
      bekzod,
      400,
      {
        kind: 'media',
        media: { type: 'sticker', mimeType: null, fileName: null, durationSec: null, emoji: '👍' }
      }
    ],
    [
      aziza,
      600,
      { kind: 'text', text: 'Savollar qiyin bo‘ladimi?', broadcast: BROADCAST, isEdit: true }
    ]
  ];
  // Padding so the list pages: older /start taps and texts spread over two weeks.
  for (let i = 0; i < 40; i++) {
    const person = PEOPLE[i % 4]!;
    drafts.push([
      person,
      800 + i * 480,
      i % 3 === 0
        ? { kind: 'command', command: 'start' }
        : { kind: 'text', text: `Eski xabar #${i + 1}` }
    ]);
  }
  return drafts.map(([person, ago, draft], index) => row(index + 1, person, ago, draft));
}

let rows = buildRows();
let nextIndex = rows.length + 1;

/** Mock control: a fresh text from Aziza, newest of all. */
export function addMockMessage(text = 'Yangi savol bor!'): void {
  rows = [row(nextIndex++, PEOPLE[0]!, 0, { kind: 'text', text }), ...rows];
}

const encode = (position: number) => btoa(String(position));
const decode = (cursor: string | null) => (cursor ? Number(atob(cursor)) : null);
const byNewest = (a: Interaction, b: Interaction) =>
  b.sentAt.localeCompare(a.sentAt) || b.id.localeCompare(a.id);

function filtered(query: URLSearchParams): Interaction[] {
  const person = query.get('person');
  const kinds = query.get('kind')?.split(',').filter(Boolean) ?? [];
  const term = (query.get('q') ?? '').trim().replace(/^@/, '').toLowerCase();
  const from = query.get('from');
  return rows.filter(
    (item) =>
      (query.get('view') === 'all' || item.signal) &&
      (person
        ? item.telegramUserId === person
        : query.get('includeAdmins') === 'true' || !item.fromAdmin) &&
      (kinds.length === 0 || kinds.includes(item.kind)) &&
      (!query.get('command') || item.command === query.get('command')) &&
      (!query.get('broadcast') || item.broadcast?.id === query.get('broadcast')) &&
      (!from || item.sentAt >= new Date(`${from}T00:00:00+05:00`).toISOString()) &&
      (!term ||
        [
          item.text,
          item.buttonLabel,
          item.from.firstName,
          item.from.lastName,
          item.from.username
        ].some((value) => value?.toLowerCase().includes(term)) ||
        item.telegramUserId === term)
  );
}

function summary(id: string): PersonSummary {
  const person = PEOPLE.find((p) => p.id === id);
  const theirs = rows.filter((item) => item.telegramUserId === id).sort(byNewest);
  return {
    telegramUserId: id,
    userId: null,
    firstName: person?.firstName ?? 'Unknown',
    lastName: person?.lastName ?? null,
    username: person?.username ?? null,
    phoneNumber: theirs.find((item) => item.contact?.isOwn)?.contact?.phoneNumber ?? null,
    firstSeenAt: theirs.at(-1)?.sentAt ?? null,
    lastSeenAt: theirs[0]?.sentAt ?? null,
    total: theirs.length,
    blocked: false
  };
}

export function listMockInteractions(query: URLSearchParams): InteractionList {
  const limit = Math.min(Math.max(Number(query.get('limit')) || 50, 1), 100);
  const newest = filtered(query).sort(byNewest);
  const since = query.get('since');
  if (since) {
    const head = rows.find((item) => item.id === atob(since));
    const items = head ? newest.filter((item) => byNewest(item, head) < 0).slice(0, limit) : [];
    return { items, nextCursor: null, headCursor: items[0] ? btoa(items[0].id) : null };
  }
  const ordered = query.get('order') === 'oldest' ? newest.reverse() : newest;
  const start = decode(query.get('cursor')) ?? 0;
  const items = ordered.slice(start, start + limit);
  const person = query.get('person');
  return {
    items,
    nextCursor: start + limit < ordered.length ? encode(start + limit) : null,
    // `since` resolves an id, not a position: positions shift as rows arrive.
    headCursor: items[0] ? btoa(items[0].id) : null,
    ...(person && start === 0 ? { person: summary(person) } : {})
  };
}

export function mockInteractionFacets(query: URLSearchParams): InteractionFacets {
  const scoped = filtered(new URLSearchParams({ view: 'all', ...Object.fromEntries(query) }));
  const kinds = Object.fromEntries(INTERACTION_KINDS.map((kind) => [kind, 0])) as Record<
    InteractionKind,
    number
  >;
  const commands = new Map<string, number>();
  for (const item of scoped) {
    kinds[item.kind] += 1;
    if (item.command) commands.set(item.command, (commands.get(item.command) ?? 0) + 1);
  }
  return {
    kinds,
    commands: [...commands]
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
  };
}
