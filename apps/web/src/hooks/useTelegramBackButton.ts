import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getTelegramBackButton } from '@/lib/telegram';

/**
 * Shows Telegram's back button while this screen is mounted, and sends it to
 * `to` when it is pressed. A no-op on the web and in clients without the
 * button, so a screen can call it unconditionally.
 *
 * A hook rather than a global side effect: only a screen knows whether it has a
 * parent to go back to, so a screen opts in. Nothing at all happens on `/`.
 *
 * **Why an explicit route and not `navigate(-1)`.** A Mini App is routinely
 * opened straight onto a deep link — a `start_param`, a shared link, a bot
 * message. There is no history behind that entry, so `navigate(-1)` either does
 * nothing or drops the user out of the Mini App entirely, which is a strange
 * thing for a back arrow inside a screen to do. Naming the parent means the
 * button always lands somewhere that exists, whether the screen was reached by
 * tapping through or by link.
 */
export function useTelegramBackButton(to: string): void {
  const navigate = useNavigate();

  useEffect(() => {
    const backButton = getTelegramBackButton();
    if (!backButton) return;

    const goToParent = () => navigate(to);

    backButton.onClick(goToParent);
    backButton.show();

    // Hide on the way out: the next screen decides for itself whether the
    // button belongs there, and a stale handler would navigate to the parent
    // of a screen nobody is looking at any more.
    return () => {
      backButton.offClick(goToParent);
      backButton.hide();
    };
  }, [navigate, to]);
}
