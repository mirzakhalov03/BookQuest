import { X } from 'lucide-react';
import type { InteractionFacets, InteractionKind } from '@bookquest/shared';
import { INTERACTION_KINDS } from '@bookquest/shared';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { formatCount, formatShortDate } from '@/lib/format';
import { useBroadcasts } from '../api/useBroadcasts';
import { RANGE_OPTIONS, type InteractionFilters, type RangePreset } from './filters';
import { KIND_LABEL } from './KindChip';

interface InteractionFiltersBarProps {
  filters: InteractionFilters;
  onChange: (patch: Partial<InteractionFilters>) => void;
  /** The search box is local until debounced, so typing never waits on the URL. */
  searchInput: string;
  onSearchInput: (value: string) => void;
  facets: InteractionFacets | undefined;
  personName: string;
}

const withCount = (label: string, count: number | undefined) =>
  count === undefined ? label : `${label} · ${formatCount(count)}`;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** Every control writes to the URL through `onChange`; this component holds no filter state. */
export function InteractionFiltersBar({
  filters,
  onChange,
  searchInput,
  onSearchInput,
  facets,
  personName
}: InteractionFiltersBarProps) {
  const broadcasts = useBroadcasts().data?.items ?? [];

  const kindOptions = [
    { value: '' as const, label: 'All kinds' },
    ...INTERACTION_KINDS.map((kind) => ({
      value: kind,
      label: withCount(KIND_LABEL[kind], facets?.kinds[kind])
    }))
  ];
  const commandOptions = [
    { value: '', label: 'All commands' },
    ...(facets?.commands ?? []).map(({ command, count }) => ({
      value: command,
      label: withCount(`/${command}`, count)
    })),
    // A command from a shared link stays selectable even if this range has none.
    ...(filters.command && !facets?.commands.some((c) => c.command === filters.command)
      ? [{ value: filters.command, label: `/${filters.command}` }]
      : [])
  ];
  const broadcastOptions = [
    { value: '', label: 'Any broadcast' },
    ...broadcasts.map((broadcast) => ({
      value: broadcast.id,
      label: `${formatShortDate(broadcast.createdAt)} — ${clip(broadcast.message, 40)}`
    }))
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Switch
          aria-label="Which rows"
          options={[
            { value: 'messages', label: 'Messages' },
            { value: 'all', label: 'Everything' }
          ]}
          value={filters.view}
          onChange={(view) => onChange({ view })}
        />
        <SearchInput
          aria-label="Search messages"
          placeholder="Name, @user, id or text"
          maxLength={80}
          value={searchInput}
          onChange={onSearchInput}
          className="w-full max-w-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Select<InteractionKind | ''>
          label="Kind"
          value={filters.kind}
          options={kindOptions}
          onChange={(kind) => onChange({ kind })}
          className="sm:w-40"
        />
        <Select
          label="Command"
          value={filters.command}
          options={commandOptions}
          onChange={(command) => onChange({ command })}
          className="sm:w-40"
        />
        <Select
          label="Broadcast"
          value={filters.broadcast}
          options={broadcastOptions}
          onChange={(broadcast) => onChange({ broadcast })}
          className="col-span-2 sm:w-64"
        />
        <Select<RangePreset>
          label="When"
          value={filters.range}
          options={RANGE_OPTIONS}
          onChange={(range) => onChange({ range })}
          className="sm:w-40"
        />
        <Select<InteractionFilters['order']>
          label="Order"
          value={filters.order}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' }
          ]}
          onChange={(order) => onChange({ order })}
          className="sm:w-36"
        />
        <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm text-paper-dim sm:col-span-1">
          <input
            type="checkbox"
            checked={filters.includeAdmins}
            onChange={(event) => onChange({ includeAdmins: event.target.checked })}
            className="h-4 w-4 accent-[color:var(--color-gold)]"
          />
          Show organisers
        </label>
      </div>

      {filters.person && (
        <div>
          <button
            type="button"
            onClick={() => onChange({ person: '' })}
            aria-label={`Stop showing only ${personName}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--rule-strong)] px-3 py-1 text-sm text-paper hover:border-paper-dim"
          >
            Only {personName}
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
