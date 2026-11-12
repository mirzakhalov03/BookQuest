import type { InteractionKind } from '@bookquest/shared';
import { INTERACTION_KINDS } from '@bookquest/shared';

/** Must match the API's ORGANISER_TIME_ZONE default: ranges are whole organiser days. */
export const ORGANISER_TIME_ZONE = 'Asia/Tashkent';
const DAY_MS = 24 * 60 * 60 * 1000;
const YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: ORGANISER_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Labels live in the dictionary (`admin.messages.range`). */
export const RANGE_PRESETS = ['today', '7d', '30d', 'all'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
const BACK_DAYS: Record<Exclude<RangePreset, 'all'>, number> = { today: 0, '7d': 6, '30d': 29 };

export interface InteractionFilters {
  view: 'messages' | 'all';
  q: string;
  kind: InteractionKind | '';
  command: string;
  broadcast: string;
  range: RangePreset;
  includeAdmins: boolean;
  person: string;
  order: 'newest' | 'oldest';
}

export const DEFAULT_FILTERS: InteractionFilters = {
  view: 'messages',
  q: '',
  kind: '',
  command: '',
  broadcast: '',
  range: '7d',
  includeAdmins: false,
  person: '',
  order: 'newest'
};

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** URL → filters. Unknown values fall back to defaults rather than breaking the page. */
export function readFilters(params: URLSearchParams): InteractionFilters {
  return {
    view: oneOf(params.get('view'), ['messages', 'all'], DEFAULT_FILTERS.view),
    q: params.get('q') ?? '',
    kind: oneOf<InteractionKind | ''>(params.get('kind'), ['', ...INTERACTION_KINDS], ''),
    command: params.get('command') ?? '',
    broadcast: params.get('broadcast') ?? '',
    range: oneOf(
      params.get('range'),
      RANGE_PRESETS,
      DEFAULT_FILTERS.range
    ),
    includeAdmins: params.get('organisers') === '1',
    person: params.get('person') ?? '',
    order: oneOf(params.get('order'), ['newest', 'oldest'], DEFAULT_FILTERS.order)
  };
}

/** Filters → URL, defaults omitted so a clean view has a clean URL. */
export function writeFilters(filters: InteractionFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.view !== DEFAULT_FILTERS.view) out.view = filters.view;
  if (filters.q) out.q = filters.q;
  if (filters.kind) out.kind = filters.kind;
  if (filters.command) out.command = filters.command;
  if (filters.broadcast) out.broadcast = filters.broadcast;
  if (filters.range !== DEFAULT_FILTERS.range) out.range = filters.range;
  if (filters.includeAdmins) out.organisers = '1';
  if (filters.person) out.person = filters.person;
  if (filters.order !== DEFAULT_FILTERS.order) out.order = filters.order;
  return out;
}

export function rangeFrom(range: RangePreset, now = new Date()): string | null {
  return range === 'all' ? null : YMD.format(new Date(now.getTime() - BACK_DAYS[range] * DAY_MS));
}

/** Filters → API query. `from` is a date string, so the cache key rolls over at organiser midnight. */
export function toQueryParams(filters: InteractionFilters): Record<string, string> {
  const params: Record<string, string> = { view: filters.view, order: filters.order };
  const from = rangeFrom(filters.range);
  if (from) params.from = from;
  if (filters.q) params.q = filters.q;
  if (filters.kind) params.kind = filters.kind;
  if (filters.command) params.command = filters.command;
  if (filters.broadcast) params.broadcast = filters.broadcast;
  if (filters.includeAdmins) params.includeAdmins = 'true';
  if (filters.person) params.person = filters.person;
  return params;
}

/** Anything that narrows the list beyond the default view, order aside. */
export function hasActiveFilters(filters: InteractionFilters): boolean {
  const { order: _order, ...rest } = writeFilters(filters);
  return Object.keys(rest).length > 0;
}
