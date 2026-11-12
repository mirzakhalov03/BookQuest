import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Paginated, Participant } from '@bookquest/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { formatCount } from '@/lib/format';
import { useAdminParticipants } from './api/useAdminParticipants';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';
import { ParticipantControls, type ParticipantSort } from './components/ParticipantControls';
import { ParticipantsTable } from './components/ParticipantsTable';
import { useT } from '@/i18n';

const LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 350;

/** `/admin/participants` — the roster with contact, which is why this endpoint is admin-only. */
export function ParticipantsPage() {
  usePullToRefresh();
  const t = useT().admin.participants;
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const query = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [sort, setSort] = useState<ParticipantSort>({ field: 'number', order: 'asc' });
  const participants = useAdminParticipants({
    q: query,
    limit: LIMIT,
    sort: sort.field,
    order: sort.order
  });

  // In the URL so a refresh, a shared link or Back keeps the search.
  useEffect(() => {
    setSearchParams(query ? { q: query } : {}, { replace: true });
  }, [query, setSearchParams]);

  return (
    <AdminScreen className="max-w-4xl">
      <div className="flex flex-col gap-3">
        <AdminPageHeader title={t.title} titleClassName="text-4xl" />
        <SearchInput
          aria-label={t.searchAria}
          placeholder={t.searchPlaceholder}
          maxLength={80}
          value={searchInput}
          onChange={setSearchInput}
          className="max-w-sm"
        />
        <ParticipantControls sort={sort} onSortChange={setSort} />
      </div>
      <AdminQuery query={participants} loadingLabel={t.loading}>
        {(data) => (
          // Old rows stay up while a new sort/search loads; dimming says the click landed.
          <div
            className={`flex flex-1 flex-col transition-opacity duration-150 ${participants.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            <Roster
              data={data}
              hasQuery={query.length > 0}
              hasMore={participants.hasNextPage}
              isLoadingMore={participants.isFetchingNextPage}
              onLoadMore={() => void participants.fetchNextPage()}
            />
          </div>
        )}
      </AdminQuery>
    </AdminScreen>
  );
}

interface RosterProps {
  data: InfiniteData<Paginated<Participant>>;
  hasQuery: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

function Roster({ data, hasQuery, hasMore, isLoadingMore, onLoadMore }: RosterProps) {
  const { common } = useT();
  const t = useT().admin.participants;
  const items = data.pages.flatMap((page) => page.items);
  const total = data.pages[0]?.total ?? 0;

  if (items.length === 0) {
    return hasQuery ? (
      <EmptyState
        title={t.noMatchTitle}
        titleAs="h2"
        body={t.noMatchBody}
        className="flex-1"
      />
    ) : (
      <EmptyState title={t.noneTitle} titleAs="h2" className="flex-1" />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="m-0 text-sm text-taupe">
        {hasQuery ? t.found(formatCount(total)) : t.registered(formatCount(total))}
      </p>
      <ParticipantsTable participants={items} />
      {hasMore && (
        <Button
          variant="quiet"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="self-center"
        >
          {isLoadingMore ? common.loading : t.showMore(formatCount(total - items.length))}
        </Button>
      )}
    </div>
  );
}
