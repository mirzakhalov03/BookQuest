import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/layouts/AppLayout';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { HomePage } from '@/features/home/HomePage';
import { RegisterPage } from '@/features/registration/RegisterPage';
import { SuccessScreen } from '@/features/registration/SuccessScreen';
import { BookPage } from '@/features/book/BookPage';
import { QuestsPage } from '@/features/quests/QuestsPage';
import { QuestEditionPage } from '@/features/quests/QuestEditionPage';
import { ResultsPage } from '@/features/results/ResultsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { RequireAdmin, RequireAuth } from '@/lib/auth/guards';
import { RouteErrorBoundary } from './RouteErrorBoundary';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    // On the root route, not each leaf: a thrown render or loader error
    // anywhere in the tree below bubbles up to this one boundary, so a
    // screen added later gets it for free instead of wiring its own.
    errorElement: <RouteErrorBoundary />,
    children: [
      // Public.
      { path: '/', element: <HomePage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/register/success', element: <SuccessScreen /> },

      { path: '/book', element: <BookPage /> },
      { path: '/quests', element: <QuestsPage /> },
      { path: '/quests/:edition', element: <QuestEditionPage /> },

      { path: '/results', element: <ResultsPage /> },

      // The session-only tree. Its screens mount as `children` of this route,
      // so they inherit the guard by position and nobody has to remember it.
      {
        path: '/me',
        element: <RequireAuth />,
        children: [{ index: true, element: <ProfilePage /> }]
      },

      // Reserved per the route table (spec §3): "Enter the quiz" already
      // navigates here and fires its haptic, but question delivery, timing
      // and submission are a separate plan (Phase 6) — not built against an
      // imagined API. Session-gated like `/me`, since a quiz is only ever
      // something a signed-in participant sits.
      {
        path: '/quiz',
        element: <RequireAuth />,
        children: [
          {
            index: true,
            element: (
              <ComingNext
                title="The quiz"
                body="One attempt, the clock running, speed counts as much as accuracy. This screen is coming next."
              />
            )
          }
        ]
      },

      // The admin tree, same shape: /admin/* children hang off this one.
      { path: '/admin', element: <RequireAdmin /> }
    ]
  }
]);

/**
 * A destination the tab bar can already reach and the screen behind it cannot
 * yet fill. Says what will be here rather than that something is missing — an
 * empty state is an invitation, not an apology (spec §4).
 */
function ComingNext({ title, body }: { title: string; body: string }) {
  return (
    <Screen>
      <EmptyState title={title} body={body} />
    </Screen>
  );
}
