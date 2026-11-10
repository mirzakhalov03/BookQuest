import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { formatCount, formatLongDate, formatTimeAgo } from '@/lib/format';
import { useAdminInteractions } from '../api/useAdminInteractions';
import { ContactLink } from '../components/ContactLink';
import { CopyButton } from '../components/CopyButton';
import { DEFAULT_FILTERS } from './filters';
import { InteractionsTable } from './InteractionsTable';

interface PersonSheetProps {
  telegramUserId: string | null;
  onClose: () => void;
  /** Narrow the main list to this person. */
  onFilter: (telegramUserId: string) => void;
}

const SHEET_PAGE = 30;

/** One person: who they are, how to reach them, and everything they sent — organiser rows included. */
export function PersonSheet({ telegramUserId, onClose, onFilter }: PersonSheetProps) {
  const timeline = useAdminInteractions(
    {
      ...DEFAULT_FILTERS,
      view: 'all',
      range: 'all',
      includeAdmins: true,
      person: telegramUserId ?? ''
    },
    SHEET_PAGE,
    { enabled: telegramUserId !== null }
  );
  const person = timeline.data?.pages[0]?.person;
  const items = timeline.data?.pages.flatMap((page) => page.items) ?? [];
  const name = person ? [person.firstName, person.lastName].filter(Boolean).join(' ') : 'Person';

  return (
    <Sheet
      open={telegramUserId !== null}
      onClose={onClose}
      title={name}
      actions={
        telegramUserId && (
          <>
            <Button variant="quiet" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="gold"
              onClick={() => {
                onFilter(telegramUserId);
                onClose();
              }}
            >
              Show in list
            </Button>
          </>
        )
      }
    >
      {!person || timeline.isPlaceholderData ? (
        timeline.error ? (
          <p className="m-0 text-taupe">Couldn't load this person. Close and try again.</p>
        ) : (
          <LoadingState label="Opening their history…" />
        )
      ) : (
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1 text-sm">
            <span className="flex flex-wrap items-center gap-x-2 text-taupe">
              {person.username && <span>@{person.username} ·</span>}
              <span>{person.telegramUserId}</span>
              <CopyButton value={person.telegramUserId} label="Copy Telegram id" />
            </span>
            {person.username ? (
              <ContactLink contact={{ method: 'telegram', value: `@${person.username}` }} />
            ) : (
              <span className="text-taupe">
                No @username: a reply from the bot is the only way to reach them.
              </span>
            )}
            {person.phoneNumber && (
              <ContactLink contact={{ method: 'phone', value: person.phoneNumber }} />
            )}
            <span className="text-taupe">
              {person.firstSeenAt && `First seen ${formatLongDate(person.firstSeenAt)}`}
              {person.lastSeenAt && ` · Last seen ${formatTimeAgo(person.lastSeenAt)}`}
              {` · ${formatCount(person.total)} interactions`}
            </span>
            {person.blocked && <span className="text-ember">Blocked the bot</span>}
          </div>
          <InteractionsTable
            compact
            items={items}
            hasMore={timeline.hasNextPage}
            isLoadingMore={timeline.isFetchingNextPage}
            onLoadMore={() => void timeline.fetchNextPage()}
          />
        </div>
      )}
    </Sheet>
  );
}
