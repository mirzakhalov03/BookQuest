import { Screen } from '@/components/layout/Screen';
import { CurrentPrizes } from './components/CurrentPrizes';
import { PreviousQuests } from './components/PreviousQuests';

/**
 * The current edition's prizes, then the archive. It's a tab, so no Telegram back button.
 * Each section loads and fails on its own, so a broken archive doesn't hide the prizes.
 */
export function PrizesPage() {
  return (
    <Screen className="gap-10">
      <CurrentPrizes />
      <PreviousQuests />
    </Screen>
  );
}
