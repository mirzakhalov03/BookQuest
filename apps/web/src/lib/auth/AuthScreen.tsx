import { useState } from 'react';
import { Screen } from '@/components/layout/Screen';
import { HeroBanner } from '@/components/HeroBanner';
import { Switch } from '@/components/ui/Switch';
import { PhoneAuthForm } from './PhoneAuthForm';
import { TelegramCodeLogin } from './TelegramCodeLogin';

type Tab = 'new' | 'registered';

const TABS = [
  { value: 'new', label: 'New here' },
  { value: 'registered', label: "I'm registered" }
] as const;

const HERO: Record<Tab, { label: string; title: string }> = {
  new: { label: 'One book. One deadline. One quiz.', title: 'Register to win the prizes' },
  registered: { label: 'Log in to pick up where you left off.', title: 'Welcome back' }
};

/**
 * What a signed-out visitor on the open web sees on any session-only route.
 * The Mini App never lands here — `initData` has already signed its users in.
 */
export function AuthScreen() {
  const [tab, setTab] = useState<Tab>('new');
  // Password log-in is the exception for returning users; the Telegram code is the default.
  const [withPassword, setWithPassword] = useState(false);

  const selectTab = (next: Tab) => {
    setTab(next);
    setWithPassword(false);
  };

  return (
    <Screen className="gap-8">
      <HeroBanner label={HERO[tab].label} title={HERO[tab].title} />

      <div className="mx-auto grid w-full max-w-[30rem] gap-8">
        <Switch aria-label="Register or log in" options={TABS} value={tab} onChange={selectTab} />

        {tab === 'new' && <PhoneAuthForm key="signup" mode="signup" />}

        {tab === 'registered' &&
          (withPassword ? (
            <>
              <PhoneAuthForm key="login" mode="login" />
              <SwapLink onClick={() => setWithPassword(false)}>Log in with a Telegram code instead</SwapLink>
            </>
          ) : (
            <>
              <TelegramCodeLogin />
              <SwapLink onClick={() => setWithPassword(true)}>
                Signed up here with a password? Log in with password
              </SwapLink>
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
