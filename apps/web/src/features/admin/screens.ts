// The admin area's single entry point: every lazy admin route imports this, so it all ships as one chunk participants never download.
export { AdminLayout } from '@/layouts/AdminLayout';
export { DashboardPage } from './DashboardPage';
export { ParticipantsPage } from './ParticipantsPage';
export { QuestEditorPage } from './quest/QuestEditorPage';
export { NewEditionPage } from './quest/NewEditionPage';
export { ResultsInspectionPage } from './ResultsInspectionPage';
export { BroadcastPage } from './broadcast/BroadcastPage';
export { MessagesPage } from './interactions/MessagesPage';
export { QuizzesPage } from './quizzes/QuizzesPage';
export { QuizEditorPage } from './quizzes/QuizEditorPage';
export { QuizPreviewPage } from './quizzes/QuizPreviewPage';
