import type { Broadcast } from '@bookquest/shared';
import { formatCount, formatLongDate } from '@/lib/format';
import type { useBroadcasts } from '../../api/useBroadcasts';
import { AdminQuery } from '../../components/AdminQuery';
import { useT, type Messages } from '@/i18n';

const TONE: Record<Broadcast['status'], string> = {
  sending: 'text-amber',
  sent: 'text-taupe',
  interrupted: 'text-error'
};

function statusText(broadcast: Broadcast, t: Messages['admin']['broadcast']): string {
  const telegram = broadcast.dmCount > 0 ? t.onTelegram(formatCount(broadcast.sentCount), formatCount(broadcast.dmCount)) : '';
  switch (broadcast.status) {
    case 'sending':
      return t.statusSending(telegram);
    case 'sent':
      return t.statusSent(formatCount(broadcast.recipientCount), telegram);
    case 'interrupted':
      return t.statusInterrupted(telegram);
  }
}

export function BroadcastHistory({ query }: { query: ReturnType<typeof useBroadcasts> }) {
  const t = useT().admin.broadcast;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-label m-0">{t.sent}</h2>
      <AdminQuery query={query} loadingLabel={t.outboxLoading}>
        {(list) =>
          list.items.length === 0 ? (
            <p className="m-0 text-sm text-taupe">{t.nothingSent}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-[color:var(--rule)] p-0">
              {list.items.map((broadcast) => (
                <li key={broadcast.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm text-taupe-dim">{formatLongDate(broadcast.createdAt)}</span>
                    <span className={`text-sm ${TONE[broadcast.status]}`}>{statusText(broadcast, t)}</span>
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
