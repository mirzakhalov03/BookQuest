import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/layouts/AppLayout';
import { HomePage } from '@/features/home/HomePage';
import { RegisterPage } from '@/features/registration/RegisterPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/register', element: <RegisterPage /> }
      // Coming later: /book, /quests, /results, /me, /quiz
    ]
  }
]);
