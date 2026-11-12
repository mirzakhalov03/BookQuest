import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useT } from '@/i18n';

/** The one "page doesn't exist" screen: the catch-all route and the route error boundary both show it. */
export function NotFoundScreen() {
  const t = useT();
  return (
    <Screen>
      <EmptyState
        title={t.nav.notFoundTitle}
        body={t.nav.notFoundBody}
      />
    </Screen>
  );
}
