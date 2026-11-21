import { PRIZE_PLACES, type Prizes } from '@bookquest/shared';
import { useT } from '@/i18n';

interface PrizeListProps {
  prizes: Prizes;
  /** Last place to list: past editions show only their top three. */
  upTo?: 3 | 5;
}

/** One announced place per row, in rank order; unset places are left out. */
export function PrizeList({ prizes, upTo = 5 }: PrizeListProps) {
  const t = useT();
  const rows = PRIZE_PLACES.filter(({ rank, key }) => rank <= upTo && prizes[key]);
  if (rows.length === 0) return null;

  return (
    <ol className="prize-list" aria-label={t.prizes.label}>
      {rows.map(({ key, rank }) => (
        <li key={key} className="prize-list__row" data-rank={rank}>
          <span className="prize-list__rank type-display" aria-hidden="true">
            {rank}.
          </span>
          <span className="prize-list__body">
            <span className="type-label">{t.common.place(rank)}</span>
            <span className="prize-list__prize">
              <span className="sr-only">{t.prizes.placeLabel(t.common.place(rank))}</span>
              {prizes[key]}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
