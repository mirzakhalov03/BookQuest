import { hasAnyPrize, type Prizes } from '@bookquest/shared';
import { useT } from '@/i18n';
import { PrizeList } from './PrizeList';
import { PrizePhoto } from './PrizePhoto';
import { PosterPlaceholder } from './PosterPlaceholder';

interface PrizeShowcaseProps {
  prizes: Prizes;
  label: string;
  /** Only the current edition can still be waiting for its poster; past ones just skip it. */
  awaitingPoster?: boolean;
}

/** The poster (or its placeholder), then every announced place as a written list. */
export function PrizeShowcase({ prizes, label, awaitingPoster = true }: PrizeShowcaseProps) {
  const t = useT().prizes;
  return (
    <div className="flex flex-col gap-3">
      {prizes.photoUrl ? (
        <PrizePhoto src={prizes.photoUrl} label={label} />
      ) : (
        awaitingPoster && <PosterPlaceholder label={label} />
      )}
      {hasAnyPrize(prizes) ? <PrizeList prizes={prizes} /> : <p className="m-0 text-taupe">{t.notAnnounced}</p>}
    </div>
  );
}
