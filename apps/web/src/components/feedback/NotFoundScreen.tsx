import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';

/** The one "page doesn't exist" screen: the catch-all route and the route error boundary both show it. */
export function NotFoundScreen() {
  return (
    <Screen>
      <EmptyState
        title="Nothing here"
        body="That page doesn't exist. Check the address, or head back to the stage."
      />
    </Screen>
  );
}
