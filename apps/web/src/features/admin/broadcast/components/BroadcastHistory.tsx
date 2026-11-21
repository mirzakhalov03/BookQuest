import { useState } from 'react';
import type { Broadcast } from '@bookquest/shared';
import { formatCount, formatLongDate } from '@/lib/format';
import type { useBroadcasts } from '../../api/useBroadcasts';
import { AdminQuery } from '../../components/AdminQuery';
import { useT, type Messages } from '@/i18n';

type Copy = Messages['admin']['broadcast'];

const STATUS_TONE: Record<Broadcast['status'], string> = {
  sending: 'border-amber/40 text-amber',
  sent: 'border-[color:var(--rule)] text-taupe',
  interrupted: 'border-error/40 text-error'
};

/** "2/2" — sent of the Telegram DMs attempted; null when it went in-app only. */
export function telegramRatio(broadcast: Broadcast): string | null {
  return broadcast.dmCount > 0 ? `${formatCount(broadcast.sentCount)}/${formatCount(broadcast.dmCount)}` : null;
}

function StatusChip({ broadcast, t }: { broadcast: Broadcast; t: Copy }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[broadcast.status]}`}>
      {t.statusLabel[broadcast.status]}
    </span>
  );
}

function TelegramCell({ broadcast, t }: { broadcast: Broadcast; t: Copy }) {
  const ratio = telegramRatio(broadcast);
  if (!ratio) return <span className="text-taupe-dim">—</span>;
  const complete = broadcast.sentCount >= broadcast.dmCount;
  return (
    <span
      title={t.telegramTitle(formatCount(broadcast.sentCount), formatCount(broadcast.dmCount))}
      className={`tabular-nums ${complete ? 'text-paper-dim' : 'text-amber'}`}
    >
      {ratio}
    </span>
  );
}

/** Click to read the whole message; one line otherwise. */
function MessageText({ message }: { message: string }) {
  const [full, setFull] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFull((v) => !v)}
      aria-expanded={full}
      className={`block w-full text-left text-paper-dim hover:text-paper ${full ? 'whitespace-pre-wrap' : 'truncate'}`}
    >
      {message}
    </button>
  );
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
            <>
              {/* Phones: two-line cards with the same facts. */}
              <ul className="m-0 flex list-none flex-col divide-y divide-[color:var(--rule)] p-0 sm:hidden">
                {list.items.map((broadcast) => (
                  <li key={broadcast.id} className="flex flex-col gap-1.5 py-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex-1 text-taupe-dim">{formatLongDate(broadcast.createdAt)}</span>
                      <span className="tabular-nums text-taupe">{formatCount(broadcast.recipientCount)}</span>
                      <TelegramCell broadcast={broadcast} t={t} />
                      <StatusChip broadcast={broadcast} t={t} />
                    </div>
                    <MessageText message={broadcast.message} />
                  </li>
                ))}
              </ul>

              <table className="hidden w-full table-fixed border-collapse text-sm sm:table">
                <thead>
                  <tr className="border-b border-[color:var(--rule)] text-left">
                    <th className="type-label w-40 py-2 pr-3 font-normal">{t.colSent}</th>
                    <th className="type-label py-2 pr-3 font-normal">{t.colMessage}</th>
                    <th className="type-label w-20 py-2 pr-3 text-right font-normal">{t.colReached}</th>
                    <th className="type-label w-24 py-2 pr-3 text-right font-normal">{t.colTelegram}</th>
                    <th className="type-label w-32 py-2 font-normal">{t.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((broadcast) => (
                    <tr key={broadcast.id} className="border-b border-[color:var(--rule)] align-top last:border-none">
                      <td className="py-3 pr-3 text-taupe-dim">{formatLongDate(broadcast.createdAt)}</td>
                      <td className="min-w-0 py-3 pr-3">
                        <MessageText message={broadcast.message} />
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-paper-dim">
                        {formatCount(broadcast.recipientCount)}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <TelegramCell broadcast={broadcast} t={t} />
                      </td>
                      <td className="py-3">
                        <StatusChip broadcast={broadcast} t={t} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )
        }
      </AdminQuery>
    </section>
  );
}
