import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/layouts/AppLayout';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { HomePage } from '@/features/home/HomePage';
import { RegisterPage } from '@/features/registration/RegisterPage';
import { SuccessScreen } from '@/features/registration/SuccessScreen';
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

      // Every tab has to lead somewhere from the commit that adds the tab bar,
      // so these three stand in until their screens land. Delete the route's
      // element, not the route.
      {
        path: '/book',
        element: (
          <ComingNext
            title="The book"
            body="What we're reading this year, how long it is, and every place you can read or listen to it. This screen is coming next."
          />
        )
      },
      {
        path: '/quests',
        element: (
          <ComingNext
            title="Past quests"
            body="Every edition before this one — its book, its winners, and how many people finished. This screen is coming next."
          />
        )
      },
      {
        path: '/results',
        element: (
          <ComingNext
            title="Results"
            body="The podium and the full leaderboard, once the quiz has closed and the marks are in. This screen is coming next."
          />
        )
      },

      // The session-only tree. Its screens mount as `children` of this route,
      // so they inherit the guard by position and nobody has to remember it.
      {
        path: '/me',
        element: <RequireAuth />,
        children: [
          {
            index: true,
            element: (
              <ComingNext
                title="You"
                body="Your participant number, the name on your certificate, and the certificate itself once the quiz is marked. This screen is coming next."
              />
            )
          }
        ]
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
