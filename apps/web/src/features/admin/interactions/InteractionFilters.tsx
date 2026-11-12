import { X } from 'lucide-react';
import type { InteractionFacets, InteractionKind } from '@bookquest/shared';
import { INTERACTION_KINDS } from '@bookquest/shared';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { formatCount, formatShortDate } from '@/lib/format';
import { useBroadcasts } from '../api/useBroadcasts';
import { RANGE_PRESETS, type InteractionFilters, type RangePreset } from './filters';
import { useT } from '@/i18n';

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
  const t = useT().admin.messages;

  const kindOptions = [
    { value: '' as const, label: t.allKinds },
    ...INTERACTION_KINDS.map((kind) => ({
      value: kind,
      label: withCount(t.kinds[kind], facets?.kinds[kind])
    }))
  ];
  const commandOptions = [
    { value: '', label: t.allCommands },
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
    { value: '', label: t.anyBroadcast },
    ...broadcasts.map((broadcast) => ({
      value: broadcast.id,
      label: `${formatShortDate(broadcast.createdAt)} — ${clip(broadcast.message, 40)}`
    }))
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Switch
          aria-label={t.rowsAria}
          options={[
            { value: 'messages', label: t.viewMessages },
            { value: 'all', label: t.viewAll }
          ]}
          value={filters.view}
          onChange={(view) => onChange({ view })}
        />
        <SearchInput
          aria-label={t.searchAria}
          placeholder={t.searchPlaceholder}
          maxLength={80}
          value={searchInput}
          onChange={onSearchInput}
          className="w-full max-w-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Select<InteractionKind | ''>
          label={t.kind}
          value={filters.kind}
          options={kindOptions}
          onChange={(kind) => onChange({ kind })}
          className="sm:w-40"
        />
        <Select
          label={t.command}
          value={filters.command}
          options={commandOptions}
          onChange={(command) => onChange({ command })}
          className="sm:w-40"
        />
        <Select
          label={t.broadcast}
          value={filters.broadcast}
          options={broadcastOptions}
          onChange={(broadcast) => onChange({ broadcast })}
          className="col-span-2 sm:w-64"
        />
        <Select<RangePreset>
          label={t.when}
          value={filters.range}
          options={RANGE_PRESETS.map((value) => ({ value, label: t.range[value] }))}
          onChange={(range) => onChange({ range })}
          className="sm:w-40"
        />
        <Select<InteractionFilters['order']>
          label={t.order}
          value={filters.order}
          options={[
            { value: 'newest', label: t.newest },
            { value: 'oldest', label: t.oldest }
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
          {t.showOrganisers}
        </label>
      </div>

      {filters.person && (
        <div>
          <button
            type="button"
            onClick={() => onChange({ person: '' })}
            aria-label={t.stopOnly(personName)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--rule-strong)] px-3 py-1 text-sm text-paper hover:border-paper-dim"
          >
            {t.only(personName)}
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
