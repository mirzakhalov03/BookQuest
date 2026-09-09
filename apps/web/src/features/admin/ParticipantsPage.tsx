import { useState } from 'react';
import { AdminScreen } from '@/layouts/AdminLayout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatCount } from '@/lib/format';
import { useAdminParticipants } from './api/useAdminParticipants';
import { ForbiddenState, isForbidden } from './components/ForbiddenState';
import { ParticipantsTable } from './components/ParticipantsTable';
import { ParticipantsPager } from './components/ParticipantsPager';

const LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * `/admin/participants` — number, name, contact, registered date. Contact is
 * the whole reason this endpoint exists separately from `ParticipantPublic`
 * (spec: admins need to reach people; everyone else gets a name and a
 * number, never a phone or a Telegram handle).
 *
 * A child of the dashboard, not a tab root, so it does get the back button.
 */
export function ParticipantsPage() {
  useTelegramBackButton('/admin');

  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);

  const query = useAdminParticipants({ q: debouncedQuery, page, limit: LIMIT });

  function handleSearchChange(value: string) {
    setSearchInput(value);
    // A new search is a new result set — staying on page 3 of an old query
    // would either show the wrong rows or a page that no longer exists.
    setPage(1);
  }

  return (
    <AdminScreen className="max-w-4xl">
      <header className="flex flex-col gap-1">
        <p className="type-label">Participants</p>
        <h1 className="type-display text-3xl text-paper">The roster</h1>
      </header>

      <label className="flex flex-col gap-1">
        <span className="type-label">Search</span>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="Name or participant number"
          className="h-11 w-full max-w-sm border-0 border-b border-b-[color:var(--rule-strong)] bg-transparent px-1 text-base text-paper placeholder:text-taupe focus:border-b-[color:var(--color-ember)] focus:outline-none"
        />
      </label>

      <Body
        query={query}
        page={page}
        onPageChange={setPage}
        limit={LIMIT}
        hasQuery={debouncedQuery.length > 0}
      />
    </AdminScreen>
  );
}

function Body({
  query,
  page,
  onPageChange,
  limit,
  hasQuery
}: {
  query: ReturnType<typeof useAdminParticipants>;
  page: number;
  onPageChange: (page: number) => void;
  limit: number;
  hasQuery: boolean;
}) {
  if (query.isPending) return <LoadingState label="Counting the roster…" />;

  if (query.error) {
    if (isForbidden(query.error)) return <ForbiddenState error={query.error} />;
    return <ErrorState error={query.error} onRetry={() => query.refetch()} className="flex-1" />;
  }

  const { items, total } = query.data;

  if (items.length === 0) {
    return hasQuery ? (
      <EmptyState
        title="No one matches that search"
        body="Try a different name or number."
        className="flex-1"
      />
    ) : (
      <EmptyState title="No one has registered yet" className="flex-1" />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm text-taupe">{formatCount(total)} registered</p>
      <ParticipantsTable participants={items} />
      <ParticipantsPager
        page={page}
        limit={limit}
        total={total}
        onPageChange={onPageChange}
        isFetching={query.isFetching}
      />
    </div>
  );
}
