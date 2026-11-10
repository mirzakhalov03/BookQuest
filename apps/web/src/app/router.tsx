import type { ComponentType } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { AppLayout } from '@/layouts/AppLayout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { NotFoundScreen } from '@/components/feedback/NotFoundScreen';
import { HomePage } from '@/features/home/HomePage';
import { SuccessScreen } from '@/features/registration/SuccessScreen';
import { BookPage } from '@/features/book/BookPage';
import { PrizesPage } from '@/features/prizes/PrizesPage';
import { QuestEditionPage } from '@/features/prizes/QuestEditionPage';
import { ResultsPage } from '@/features/results/ResultsPage';
import { QuizPage } from '@/features/quiz/QuizPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { RequireAdmin, RequireAuth } from '@/lib/auth/guards';
import { RouteErrorBoundary } from './RouteErrorBoundary';

type AdminScreens = typeof import('@/features/admin/screens');

// Every admin route loads the same module, so the whole area is one chunk fetched on first visit.
const adminScreen = (name: keyof AdminScreens) => ({
  lazy: async () => ({ Component: (await import('@/features/admin/screens'))[name] as ComponentType })
});

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    // On the root, so every screen below, including future ones, gets it for free.
    errorElement: <RouteErrorBoundary />,
    // Shown while a lazy route loads on a cold open of /admin.
    hydrateFallbackElement: <LoadingState label="Opening the organiser desk…" />,
    children: [
      // Public.
      { path: '/', element: <HomePage /> },
      // `/me` owns joining now; old links and bookmarks land there.
      { path: '/register', element: <Navigate to="/me" replace /> },

      { path: '/book', element: <BookPage /> },
      { path: '/prizes', element: <PrizesPage /> },
      // The archive moved into `/prizes`; old links land there. Single editions keep their URL.
      { path: '/quests', element: <Navigate to="/prizes" replace /> },
      { path: '/quests/:edition', element: <QuestEditionPage /> },

      // Public countdown until the quiz is built; the quiz itself will need a session.
      { path: '/quiz', element: <QuizPage /> },
      { path: '/results', element: <ResultsPage /> },

      // Session-only: children inherit the guard by position.
      {
        path: '/me',
        element: <RequireAuth />,
        children: [
          { index: true, element: <ProfilePage /> },
          { path: 'welcome', element: <SuccessScreen /> }
        ]
      },

      // Always someone's own, so guarded like `/me`.
      {
        path: '/notifications',
        element: <RequireAuth />,
        children: [{ index: true, element: <NotificationsPage /> }]
      },

      // Admin: inherits the guard (UX only; the API enforces) and the shell by position. The guard stays eager.
      {
        path: '/admin',
        element: <RequireAdmin />,
        children: [
          {
            ...adminScreen('AdminLayout'),
            children: [
              { index: true, ...adminScreen('DashboardPage') },
              { path: 'participants', ...adminScreen('ParticipantsPage') },
              { path: 'quest', ...adminScreen('QuestEditorPage') },
              { path: 'quest/new', ...adminScreen('NewEditionPage') },
              { path: 'results', ...adminScreen('ResultsInspectionPage') },
              { path: 'broadcast', ...adminScreen('BroadcastPage') },
              { path: 'messages', ...adminScreen('MessagesPage') }
            ]
          }
        ]
      },

      // The URL first asked for; the page lives under /admin for the guard and the admin chunk.
      { path: '/all-usermessages', element: <Navigate to="/admin/messages" replace /> },

      // Without it a typo raises an ErrorResponse and reads as a network failure.
      { path: '*', element: <NotFoundScreen /> }
    ]
  }
]);
