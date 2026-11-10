import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AdminQuery } from '../components/AdminQuery';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminKeys } from '../api/adminKeys';
import {
  interactionListParams,
  useAdminInteractions,
  useInteractionFacets,
  useNewInteractionCount
} from '../api/useAdminInteractions';
import {
  DEFAULT_FILTERS,
  RANGE_OPTIONS,
  hasActiveFilters,
  readFilters,
  writeFilters,
  type InteractionFilters
} from './filters';
import { InteractionFiltersBar } from './InteractionFilters';
import { InteractionsTable } from './InteractionsTable';
import { PersonSheet } from './PersonSheet';

const SEARCH_DEBOUNCE_MS = 350;
const LIMIT = 50;

/** `/admin/messages` — what people say to the bot. Filters live in the URL: refresh, Back and shared links keep the view. */
export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = useState(filters.q);
  const q = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const update = useCallback(
    (patch: Partial<InteractionFilters>) =>
      setSearchParams((current) => writeFilters({ ...readFilters(current), ...patch }), {
        replace: true
      }),
    [setSearchParams]
  );

  useEffect(() => {
    update({ q });
  }, [q, update]);

  const list = useAdminInteractions(filters, LIMIT);
  const facets = useInteractionFacets(filters);
  const headCursor = list.isPlaceholderData ? null : (list.data?.pages[0]?.headCursor ?? null);
  const newCount = useNewInteractionCount(filters, headCursor).data ?? 0;

  // Reset, not refetch: refetching cursor pages after page 1 grew would duplicate rows at the seams.
  const showNew = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void queryClient.resetQueries({
      queryKey: adminKeys.interactions(interactionListParams(filters, LIMIT)),
      exact: true
    });
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  const person = list.data?.pages[0]?.person;
  const personName = person ? person.firstName : 'this person';

  return (
    <AdminScreen>
      <div className="flex flex-col gap-3">
        <AdminPageHeader
          title="Messages"
          titleClassName="text-4xl"
          actions={
            newCount > 0 ? (
              <Button variant="gold" onClick={showNew} aria-live="polite">
                ● {newCount >= 100 ? '99+' : newCount} new
              </Button>
            ) : undefined
          }
        />
        <InteractionFiltersBar
          filters={filters}
          onChange={update}
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          facets={facets.data}
          personName={personName}
        />
      </div>
      <AdminQuery query={list} loadingLabel="Reading the inbox…">
        {(data) => {
          const items = data.pages.flatMap((page) => page.items);
          if (items.length === 0) {
            return <Empty filters={filters} personName={personName} onClear={clearFilters} />;
          }
          return (
            // Old rows stay up while a new filter loads; dimming says the click landed.
            <div
              className={`flex flex-1 flex-col transition-opacity duration-150 ${list.isPlaceholderData ? 'opacity-60' : ''}`}
            >
              <InteractionsTable
                items={items}
                hasMore={list.hasNextPage}
                isLoadingMore={list.isFetchingNextPage}
                onLoadMore={() => void list.fetchNextPage()}
                onOpenPerson={setOpenPerson}
              />
            </div>
          );
        }}
      </AdminQuery>
      <PersonSheet
        telegramUserId={openPerson}
        onClose={() => setOpenPerson(null)}
        onFilter={(id) => update({ person: id })}
      />
    </AdminScreen>
  );
}

interface EmptyProps {
  filters: InteractionFilters;
  personName: string;
  onClear: () => void;
}

/** Says which filter emptied the list, so "nothing here" is never a mystery. */
function Empty({ filters, personName, onClear }: EmptyProps) {
  const what = filters.view === 'messages' ? 'messages' : 'activity';
  const who = filters.person ? ` from ${personName}` : '';
  const range = RANGE_OPTIONS.find((option) => option.value === filters.range);
  const when = filters.range === 'all' || !range ? '' : ` ${range.label.toLowerCase()}`;
  const narrowed = !!(filters.q || filters.kind || filters.command || filters.broadcast);
  const body = narrowed
    ? 'Search or filters are narrowing this down.'
    : filters.view === 'messages'
      ? 'Switch to Everything to see /start taps and button presses too.'
      : undefined;

  return (
    <EmptyState
      title={`No ${what}${who}${when}`}
      titleAs="h2"
      body={body}
      className="flex-1"
      action={
        hasActiveFilters(filters) || filters.order !== DEFAULT_FILTERS.order ? (
          <Button variant="quiet" onClick={onClear}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
}
