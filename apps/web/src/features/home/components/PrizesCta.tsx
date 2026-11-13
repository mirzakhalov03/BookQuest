import { Link } from 'react-router';
import { Trophy } from 'lucide-react';
import { PRIZE_PLACES, countPrizes, hasAnyPrize, type Prizes, type QuestPhase } from '@bookquest/shared';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { haptic } from '@/lib/telegram';
import { useT } from '@/i18n';

interface PrizesCtaProps {
  prizes: Prizes;
  phase: QuestPhase;
}

/**
 * The way from Home into Prizes, led by the top prize. Secondary to
 * `QuestAction`; hidden when there's nothing to show, and once the quest is
 * finished, when results matter more.
 */
export function PrizesCta({ prizes, phase }: PrizesCtaProps) {
  const t = useT().home;
  if (!hasAnyPrize(prizes) || phase === 'finished') return null;

  // The first place someone actually filled in, so "Win …" is never empty.
  const topPrize = PRIZE_PLACES.map(({ key }) => prizes[key]).find(Boolean) as string;
  const more = countPrizes(prizes) - 1;

  return (
    <Link to="/prizes" onClick={() => haptic('select')} className="prizes-cta group">
      <span className="prizes-cta__medal" aria-hidden="true">
        {prizes.photoUrl ? (
          <img src={prizes.photoUrl} alt="" className="prizes-cta__thumb" decoding="async" />
        ) : (
          <Trophy className="size-5" strokeWidth={1.6} />
        )}
      </span>
      <span className="prizes-cta__text">
        <span className="prizes-cta__headline">{t.winPrize(topPrize)}</span>
        {more > 0 && <span className="prizes-cta__more">{t.morePrizes(more)}</span>}
      </span>
      <ArrowIcon />
      <span className="prizes-cta__shine" aria-hidden="true" />
    </Link>
  );
}
