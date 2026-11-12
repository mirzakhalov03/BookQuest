import type { Quest } from '@bookquest/shared';
import { Screen } from '@/components/layout/Screen';
import { HeroBanner } from '@/components/HeroBanner';
import { EditionMark } from './components/EditionMark';
import { RegistrationForm } from './components/RegistrationForm';
import { useT } from '@/i18n';
import { LanguagePicker } from '@/features/profile/components/LanguagePicker';

/** `/me` for a signed-in user who hasn't joined the current quest. The reveal follows at `/me/welcome`. */
export function JoinQuest({ quest }: { quest: Quest }) {
  const t = useT();
  return (
    <Screen className="gap-10">
      <HeroBanner label={<EditionMark edition={quest.edition} />} title={t.auth.heroNewTitle} />
      <div className="mx-auto w-full max-w-[30rem]">
        <RegistrationForm />
      </div>
      <div className="mx-auto w-full max-w-[30rem]">
        <LanguagePicker />
      </div>
    </Screen>
  );
}
