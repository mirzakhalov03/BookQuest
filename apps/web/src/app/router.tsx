import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/layouts/AppLayout';
import { HomePage } from '@/features/home/HomePage';
import { RegisterPage } from '@/features/registration/RegisterPage';
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
      // Public. Coming later: /book, /quests, /quests/:edition, /results.
      { path: '/', element: <HomePage /> },
      { path: '/register', element: <RegisterPage /> },

      // The session-only tree. Its screens mount as `children` of this route,
      // so they inherit the guard by position and nobody has to remember it.
      { path: '/me', element: <RequireAuth /> },

      // The admin tree, same shape: /admin/* children hang off this one.
      { path: '/admin', element: <RequireAdmin /> }
    ]
  }
]);
