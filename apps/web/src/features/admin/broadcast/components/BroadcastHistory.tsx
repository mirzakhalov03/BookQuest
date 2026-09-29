import type { Broadcast } from '@bookquest/shared';
import { formatCount, formatLongDate } from '@/lib/format';
import type { useBroadcasts } from '../../api/useBroadcasts';
import { AdminQuery } from '../../components/AdminQuery';

const TONE: Record<Broadcast['status'], string> = {
  sending: 'text-amber',
  sent: 'text-taupe',
  interrupted: 'text-error'
};

function statusText(broadcast: Broadcast): string {
  const telegram =
    broadcast.dmCount > 0 ? ` · ${formatCount(broadcast.sentCount)} of ${formatCount(broadcast.dmCount)} on Telegram` : '';
  switch (broadcast.status) {
    case 'sending':
      return `Sending${telegram}`;
    case 'sent':
      return `Reached ${formatCount(broadcast.recipientCount)}${telegram}`;
    case 'interrupted':
      return `Interrupted${telegram}`;
  }
}

export function BroadcastHistory({ query }: { query: ReturnType<typeof useBroadcasts> }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-label m-0">Sent</h2>
      <AdminQuery query={query} loadingLabel="Opening the outbox…">
        {(list) =>
          list.items.length === 0 ? (
            <p className="m-0 text-sm text-taupe">Nothing sent yet.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-[color:var(--rule)] p-0">
              {list.items.map((broadcast) => (
                <li key={broadcast.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm text-taupe-dim">{formatLongDate(broadcast.createdAt)}</span>
                    <span className={`text-sm ${TONE[broadcast.status]}`}>{statusText(broadcast)}</span>
                  </div>
                  <p className="m-0 line-clamp-3 whitespace-pre-wrap text-paper-dim">{broadcast.message}</p>
                </li>
              ))}
            </ul>
          )
        }
      </AdminQuery>
    </section>
  );
}
