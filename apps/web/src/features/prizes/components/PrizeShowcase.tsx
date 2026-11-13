import type { Prizes } from '@bookquest/shared';
import { PrizePodium } from './PrizePodium';
import { PrizeList } from './PrizeList';
import { PrizePhoto } from './PrizePhoto';

/** With a photo: the photo, then every place as a list. Without: the podium, then 4th–5th as rows. */
export function PrizeShowcase({ prizes, label }: { prizes: Prizes; label: string }) {
  if (prizes.photoUrl) {
    return (
      <div className="flex flex-col gap-2">
        <PrizePhoto src={prizes.photoUrl} label={label} />
        <PrizeList prizes={prizes} from={1} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <PrizePodium prizes={prizes} />
      <PrizeList prizes={prizes} from={4} />
    </div>
  );
}
