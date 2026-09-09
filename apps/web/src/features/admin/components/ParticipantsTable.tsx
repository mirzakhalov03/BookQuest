import type { Participant } from '@bookquest/shared';
import { ParticipantNumeral } from '@/components/ui/ParticipantNumeral';
import { formatLongDate } from '@/lib/format';

/**
 * Two renderings of the same rows, not one table forced to behave at every
 * width. A table that only reflows below 640px turns into either a
 * horizontal scrollbar (four columns of unequal, unpredictable width — a
 * long name and a long email address both live in this row — make a poor
 * scroll target on a touch screen) or a fifth truncated column nobody can
 * read fully. A card per participant keeps every field readable at 390px
 * without cutting anything, and costs nothing on top of the table markup:
 * `sm:hidden` / `hidden sm:table` swap them, no JS branch.
 */
export function ParticipantsTable({ participants }: { participants: Participant[] }) {
  return (
    <>
      <ul className="flex flex-col gap-2 sm:hidden">
        {participants.map((participant) => (
          <li
            key={participant.id}
            className="flex flex-col gap-2 rounded-[3px] border border-[color:var(--rule)] px-3 py-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <ParticipantNumeral value={participant.number} className="type-display text-lg text-gold" />
              <span className="text-sm text-taupe-dim">{formatLongDate(participant.registeredAt)}</span>
            </div>
            <p className="text-paper">{participant.fullName}</p>
            <p className="text-sm text-taupe-dim">
              <span className="type-label mr-1">{participant.contact.method}</span>
              {participant.contact.value}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--rule-strong)] text-taupe">
              <th className="type-label py-2 pr-3 font-normal">Number</th>
              <th className="type-label py-2 pr-3 font-normal">Name</th>
              <th className="type-label py-2 pr-3 font-normal">Contact</th>
              <th className="type-label py-2 pr-3 font-normal">Registered</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <tr key={participant.id} className="border-b border-[color:var(--rule)]">
                <td className="py-2 pr-3">
                  <ParticipantNumeral value={participant.number} className="type-display text-base text-gold" />
                </td>
                <td className="py-2 pr-3 text-paper">{participant.fullName}</td>
                <td className="py-2 pr-3 text-paper-dim">
                  <span className="type-label mr-1">{participant.contact.method}</span>
                  {participant.contact.value}
                </td>
                <td className="py-2 pr-3 text-taupe-dim">{formatLongDate(participant.registeredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
