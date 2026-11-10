import { Types } from 'mongoose';
import type {
  Interaction,
  InteractionFacets,
  InteractionInput,
  InteractionKind,
  InteractionList,
  MediaType,
  PersonSummary
} from '@bookquest/shared';
import { INTERACTION_KINDS } from '@bookquest/shared';
import { adminTelegramIds, env } from '../config/env.js';
import {
  BotInteractionModel,
  type BotInteractionAttributes
} from '../models/bot-interaction.model.js';
import { BroadcastModel } from '../models/broadcast.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { UserModel, type UserAttributes } from '../models/user.model.js';
import type {
  AdminInteractionFacetsQuery,
  AdminInteractionQuery
} from '../validators/admin.validators.js';
import { encodeCursor, type Cursor } from '../utils/cursor.js';
import { isOnlyDuplicateKeyErrors } from '../utils/mongo.js';
import { escapeRegex } from '../utils/regex.js';
import { dayEndIn, dayStartIn } from '../utils/time-zone.js';
import { isSignal } from './interaction-classify.services.js';
import { isAdmin } from './user.services.js';

/** A reply within this long after a broadcast is read as a reaction to it. */
const BROADCAST_WINDOW_MS = 72 * 60 * 60 * 1000;

type LeanUser = Pick<UserAttributes, 'telegramUserId' | 'role' | 'phoneNumber'> & {
  _id: Types.ObjectId;
};

/** POST /bot/interactions. Idempotent per updateId; returns how many items are now stored. */
export async function recordInteractions(items: InteractionInput[]): Promise<number> {
  const telegramIds = [...new Set(items.map((item) => item.telegramUserId))];
  const users = await UserModel.find(
    { telegramUserId: { $in: telegramIds } },
    { _id: 1, telegramUserId: 1, role: 1, phoneNumber: 1 }
  ).lean<LeanUser[]>();
  const userByTelegramId = new Map(users.map((user) => [user.telegramUserId!, user]));
  const broadcastFor = await recentBroadcastLookup(items, users);

  const docs = items.map((item) => {
    const user = userByTelegramId.get(item.telegramUserId);
    const sentAt = new Date(item.sentAt);
    return {
      ...item,
      sentAt,
      isEdit: item.isEdit ?? false,
      signal: isSignal(item),
      user: user?._id ?? null,
      fromAdmin: adminTelegramIds.has(item.telegramUserId) || (!!user && isAdmin(user)),
      broadcast: user ? broadcastFor(user._id, sentAt) : null
    };
  });

  await applyMembership(items);

  try {
    await BotInteractionModel.insertMany(docs, { ordered: false });
  } catch (error) {
    if (!isOnlyDuplicateKeyErrors(error)) throw error;
  }
  return docs.length;
}

type BroadcastLookup = (userId: Types.ObjectId, sentAt: Date) => Types.ObjectId | null;

/** One query per batch: each person's broadcasts in the window, newest first, matched in memory. */
async function recentBroadcastLookup(
  items: InteractionInput[],
  users: LeanUser[]
): Promise<BroadcastLookup> {
  if (users.length === 0) return () => null;
  const times = items.map((item) => Date.parse(item.sentAt));
  const notes = await NotificationModel.find(
    {
      user: { $in: users.map((user) => user._id) },
      kind: 'broadcast',
      createdAt: {
        $gte: new Date(Math.min(...times) - BROADCAST_WINDOW_MS),
        $lte: new Date(Math.max(...times))
      }
    },
    { user: 1, broadcast: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .lean<{ user: Types.ObjectId; broadcast: Types.ObjectId | null; createdAt: Date }[]>();

  const byUser = new Map<string, typeof notes>();
  for (const note of notes) {
    const key = String(note.user);
    byUser.set(key, [...(byUser.get(key) ?? []), note]);
  }

  return (userId, sentAt) => {
    const at = sentAt.getTime();
    const match = byUser
      .get(String(userId))
      ?.find(
        (note) =>
          note.createdAt.getTime() <= at && note.createdAt.getTime() >= at - BROADCAST_WINDOW_MS
      );
    return match?.broadcast ?? null;
  };
}

/** Block/unblock keeps `dmBlockedAt` true before the next broadcast finds out. Time-guarded so a late retry can't undo a newer state. */
async function applyMembership(items: InteractionInput[]): Promise<void> {
  const latest = new Map<string, InteractionInput>();
  for (const item of items) {
    if (!item.membership) continue;
    const seen = latest.get(item.telegramUserId);
    // ISO-8601 UTC strings order correctly as strings.
    if (!seen || seen.sentAt < item.sentAt) latest.set(item.telegramUserId, item);
  }
  if (latest.size === 0) return;

  await UserModel.bulkWrite(
    [...latest.values()].map((item) => {
      const sentAt = new Date(item.sentAt);
      return item.membership === 'blocked'
        ? {
            updateOne: {
              filter: {
                telegramUserId: item.telegramUserId,
                $or: [{ dmBlockedAt: null }, { dmBlockedAt: { $lt: sentAt } }]
              },
              update: { $set: { dmBlockedAt: sentAt } }
            }
          }
        : {
            updateOne: {
              filter: { telegramUserId: item.telegramUserId, dmBlockedAt: { $lte: sentAt } },
              update: { $set: { dmBlockedAt: null } }
            }
          };
    }),
    { ordered: false }
  );
}

/* ── Admin reads ─────────────────────────────────────────────────────── */

type Row = BotInteractionAttributes & { _id: Types.ObjectId };
type Filter = Record<string, unknown>;
const SNIPPET = 80;

function rangeFilter(from?: string, to?: string): Filter {
  if (!from && !to) return {};
  return {
    sentAt: {
      ...(from ? { $gte: dayStartIn(env.ORGANISER_TIME_ZONE, from) } : {}),
      ...(to ? { $lt: dayEndIn(env.ORGANISER_TIME_ZONE, to) } : {})
    }
  };
}

// Rows strictly older or newer than a cursor, in (sentAt, _id) order.
function beyond(cursor: Cursor, direction: 'older' | 'newer'): Filter {
  const op = direction === 'older' ? '$lt' : '$gt';
  return {
    $or: [{ sentAt: { [op]: cursor.sentAt } }, { sentAt: cursor.sentAt, _id: { [op]: cursor.id } }]
  };
}

function buildFilter(query: AdminInteractionQuery): Filter[] {
  const and: Filter[] = [rangeFilter(query.from, query.to)];
  if (query.view === 'messages') and.push({ signal: true });
  if (query.hasContact) and.push({ kind: 'contact' });
  else if (query.kind?.length) and.push({ kind: { $in: query.kind } });
  if (query.person) and.push({ telegramUserId: query.person });
  // Organisers testing the bot are noise — except on one person's own timeline.
  else if (!query.includeAdmins) and.push({ fromAdmin: false });
  if (query.command) and.push({ command: query.command });
  if (query.broadcast) and.push({ broadcast: new Types.ObjectId(query.broadcast) });

  const term = query.q?.trim();
  if (term) {
    const rx = { $regex: escapeRegex(term.replace(/^@/, '')), $options: 'i' };
    and.push({
      $or: [
        { text: rx },
        { buttonLabel: rx },
        { 'from.firstName': rx },
        { 'from.lastName': rx },
        { 'from.username': rx },
        ...(/^\d+$/.test(term) ? [{ telegramUserId: term }] : [])
      ]
    });
  }
  return and.filter((part) => Object.keys(part).length > 0);
}

/** GET /admin/interactions. Cursor pages: new rows arrive on top while someone scrolls. */
export async function listInteractions(query: AdminInteractionQuery): Promise<InteractionList> {
  const newestFirst = query.order === 'newest';
  const and = buildFilter(query);

  // `since` (the new-rows poll) ignores order and cursor: newer than the reader's top row, newest first.
  if (query.since) and.push(beyond(query.since, 'newer'));
  else if (query.cursor) and.push(beyond(query.cursor, newestFirst ? 'older' : 'newer'));

  const direction = query.since || newestFirst ? -1 : 1;
  const rows = await BotInteractionModel.find(and.length > 0 ? { $and: and } : {})
    .sort({ sentAt: direction, _id: direction })
    .limit(query.limit + 1)
    .lean<Row[]>();

  const page = rows.slice(0, query.limit);
  const first = page[0];
  const last = page.at(-1);
  const snippets = await broadcastSnippets(page);
  const firstPage = !query.cursor && !query.since;

  return {
    items: page.map((row) => toInteractionDto(row, snippets)),
    nextCursor:
      !query.since && rows.length > query.limit && last
        ? encodeCursor(last.sentAt, last._id)
        : null,
    headCursor: first ? encodeCursor(first.sentAt, first._id) : null,
    ...(query.person && firstPage ? { person: await personSummary(query.person) } : {})
  };
}

async function broadcastSnippets(rows: Row[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.flatMap((row) => (row.broadcast ? [String(row.broadcast)] : [])))];
  if (ids.length === 0) return new Map();
  const broadcasts = await BroadcastModel.find({ _id: { $in: ids } }, { message: 1 }).lean();
  return new Map(
    broadcasts.map((broadcast) => [
      String(broadcast._id),
      broadcast.message.length > SNIPPET
        ? `${broadcast.message.slice(0, SNIPPET)}…`
        : broadcast.message
    ])
  );
}

function toInteractionDto(row: Row, snippets: Map<string, string>): Interaction {
  const broadcastId = row.broadcast ? String(row.broadcast) : null;
  return {
    id: String(row._id),
    kind: row.kind as InteractionKind,
    signal: row.signal,
    isEdit: row.isEdit ?? false,
    telegramUserId: row.telegramUserId,
    userId: row.user ? String(row.user) : null,
    from: {
      firstName: row.from.firstName ?? '',
      lastName: row.from.lastName ?? null,
      username: row.from.username ?? null
    },
    fromAdmin: row.fromAdmin ?? false,
    text: row.text ?? null,
    command: row.command ?? null,
    commandArgs: row.commandArgs ?? null,
    buttonLabel: row.buttonLabel ?? null,
    callbackData: row.callbackData ?? null,
    contact: row.contact
      ? {
          phoneNumber: row.contact.phoneNumber ?? '',
          firstName: row.contact.firstName ?? null,
          isOwn: !!row.contact.isOwn
        }
      : null,
    // fileId stays server-side until media preview exists.
    media: row.media
      ? {
          type: row.media.type as MediaType,
          mimeType: row.media.mimeType ?? null,
          fileName: row.media.fileName ?? null,
          durationSec: row.media.durationSec ?? null,
          emoji: row.media.emoji ?? null
        }
      : null,
    location: row.location ? { lat: row.location.lat ?? 0, lng: row.location.lng ?? 0 } : null,
    membership: (row.membership as Interaction['membership']) ?? null,
    inReplyTo: row.inReplyTo
      ? { messageId: row.inReplyTo.messageId ?? 0, text: row.inReplyTo.text ?? null }
      : null,
    broadcast: broadcastId ? { id: broadcastId, snippet: snippets.get(broadcastId) ?? '' } : null,
    sentAt: row.sentAt.toISOString()
  };
}

async function personSummary(telegramUserId: string): Promise<PersonSummary> {
  const [user, totals, latest, ownContact] = await Promise.all([
    UserModel.findOne(
      { telegramUserId },
      { firstName: 1, lastName: 1, username: 1, phoneNumber: 1, dmBlockedAt: 1 }
    ).lean(),
    BotInteractionModel.aggregate<{ total: number; first: Date; last: Date }>([
      { $match: { telegramUserId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          first: { $min: '$sentAt' },
          last: { $max: '$sentAt' }
        }
      }
    ]),
    BotInteractionModel.findOne({ telegramUserId }, { from: 1 }).sort({ sentAt: -1 }).lean<Row>(),
    BotInteractionModel.findOne(
      { telegramUserId, kind: 'contact', 'contact.isOwn': true },
      { contact: 1 }
    )
      .sort({ sentAt: -1 })
      .lean<Row>()
  ]);
  const stats = totals[0];
  return {
    telegramUserId,
    userId: user ? String(user._id) : null,
    firstName: user?.firstName ?? latest?.from.firstName ?? 'Unknown',
    lastName: user?.lastName ?? latest?.from.lastName ?? null,
    username: user?.username ?? latest?.from.username ?? null,
    phoneNumber: user?.phoneNumber ?? ownContact?.contact?.phoneNumber ?? null,
    firstSeenAt: stats ? stats.first.toISOString() : null,
    lastSeenAt: stats ? stats.last.toISOString() : null,
    total: stats?.total ?? 0,
    blocked: !!user?.dmBlockedAt
  };
}

/** GET /admin/interactions/facets — drives the Kind and Command dropdowns, so new commands appear by themselves. */
export async function getFacets(query: AdminInteractionFacetsQuery): Promise<InteractionFacets> {
  const match: Filter = {
    ...rangeFilter(query.from, query.to),
    ...(query.includeAdmins ? {} : { fromAdmin: false })
  };
  const [byKind, byCommand] = await Promise.all([
    BotInteractionModel.aggregate<{ _id: InteractionKind; count: number }>([
      { $match: match },
      { $group: { _id: '$kind', count: { $sum: 1 } } }
    ]),
    BotInteractionModel.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, command: { $exists: true } } },
      { $group: { _id: '$command', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 50 }
    ])
  ]);
  const kinds = Object.fromEntries(INTERACTION_KINDS.map((kind) => [kind, 0])) as Record<
    InteractionKind,
    number
  >;
  for (const { _id, count } of byKind) kinds[_id] = count;
  return { kinds, commands: byCommand.map(({ _id, count }) => ({ command: _id, count })) };
}
