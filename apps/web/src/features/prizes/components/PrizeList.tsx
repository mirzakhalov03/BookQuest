import { PRIZE_PLACES, type Prizes } from '@bookquest/shared';
import { useT } from '@/i18n';

interface PrizeListProps {
  prizes: Prizes;
  /** 1 lists every place (beside a photo); 4 continues under the podium. */
  from?: 1 | 4;
}

/**
 * Places as ranked rows: the same system whether it carries all five or just
 * 4th–5th under the podium. 1–3 keep "To be announced" like the podium does;
 * 4th and 5th are simply left out when nobody set them.
 */
export function PrizeList({ prizes, from = 1 }: PrizeListProps) {
  const t = useT();
  const rows = PRIZE_PLACES.filter(({ rank, key }) => rank >= from && (rank <= 3 || prizes[key]));
  if (rows.length === 0) return null;

  return (
    // Under the podium it continues that list, so only the standalone list gets its own name.
    <ol className="prize-list" start={from} aria-label={from === 1 ? t.prizes.label : undefined}>
      {rows.map(({ key, rank }) => {
        const prize = prizes[key];
        return (
          <li key={key} className="prize-list__row" data-rank={rank}>
            <span className="prize-list__rank type-display" aria-hidden="true">
              {rank}
            </span>
            <span className="prize-list__body">
              <span className="type-label">{t.common.place(rank)}</span>
              <span className={`prize-list__prize ${prize ? '' : 'is-empty'}`}>
                <span className="sr-only">{t.prizes.placeLabel(t.common.place(rank))}</span>
                {prize ?? t.prizes.toBeAnnounced}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
