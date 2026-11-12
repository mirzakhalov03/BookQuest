import { useState } from 'react';
import { Screen } from '@/components/layout/Screen';
import { HeroBanner } from '@/components/HeroBanner';
import { Switch } from '@/components/ui/Switch';
import { PhoneAuthForm } from './PhoneAuthForm';
import { TelegramCodeLogin } from './TelegramCodeLogin';
import { useT } from '@/i18n';

type Tab = 'new' | 'registered';

/**
 * What a signed-out visitor on the open web sees on any session-only route.
 * The Mini App never lands here — `initData` has already signed its users in.
 */
export function AuthScreen() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('new');
  const tabs = [
    { value: 'new', label: t.auth.tabNew },
    { value: 'registered', label: t.auth.tabRegistered }
  ] as const;
  const hero: Record<Tab, { label: string; title: string }> = {
    new: { label: t.common.appTagline, title: t.auth.heroNewTitle },
    registered: { label: t.auth.heroBackLabel, title: t.auth.heroBackTitle }
  };
  // Password log-in is the exception for returning users; the Telegram code is the default.
  const [withPassword, setWithPassword] = useState(false);

  const selectTab = (next: Tab) => {
    setTab(next);
    setWithPassword(false);
  };

  return (
    <Screen className="gap-8">
      <HeroBanner label={hero[tab].label} title={hero[tab].title} />

      <div className="mx-auto grid w-full max-w-[30rem] gap-8">
        <Switch aria-label={t.auth.tabsAria} options={tabs} value={tab} onChange={selectTab} />

        {tab === 'new' && <PhoneAuthForm key="signup" mode="signup" />}

        {tab === 'registered' &&
          (withPassword ? (
            <>
              <PhoneAuthForm key="login" mode="login" />
              <SwapLink onClick={() => setWithPassword(false)}>{t.auth.useTelegramCode}</SwapLink>
            </>
          ) : (
            <>
              <TelegramCodeLogin />
              <SwapLink onClick={() => setWithPassword(true)}>{t.auth.usePassword}</SwapLink>
            </>
          ))}
      </div>
    </Screen>
  );
}

function SwapLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-label justify-self-start text-taupe transition-colors hover:text-paper-dim"
    >
      {children}
    </button>
  );
}
