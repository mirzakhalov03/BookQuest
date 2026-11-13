import { PRIZE_PLACES, type Prizes } from '@bookquest/shared';
import { useT } from '@/i18n';

// The stand has three steps; 4th–5th continue below it in `PrizeList`.
const PLACES = PRIZE_PLACES.slice(0, 3);

/**
 * A 2nd–1st–3rd stand. The DOM stays in rank order for screen readers; CSS `order` builds the stand.
 * A place with no prize keeps its block so the stand doesn't collapse into two steps.
 */
export function PrizePodium({ prizes }: { prizes: Prizes }) {
  const t = useT();
  return (
    <ol className="prize-podium" aria-label={t.prizes.label}>
      {PLACES.map(({ key, rank }) => {
        const prize = prizes[key];
        return (
          <li key={key} className="prize-podium__place" data-rank={rank}>
            <p className={`prize-podium__prize ${prize ? '' : 'is-empty'}`}>
              <span className="sr-only">{t.prizes.placeLabel(t.common.place(rank))}</span>
              {prize ?? t.prizes.toBeAnnounced}
            </p>
            <div className="prize-podium__block" aria-hidden="true">
              <span className="prize-podium__rank type-display">{rank}</span>
              <span className="type-label">{t.common.placeShort(rank)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
