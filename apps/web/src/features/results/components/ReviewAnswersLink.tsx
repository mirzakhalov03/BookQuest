import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/useAuth';
import { useQuizOverview } from '@/features/quiz/api/useQuizOverview';
import { useT } from '@/i18n';

/** The way back to your own answers once results are out (`/quiz` redirects here by then). */
export function ReviewAnswersLink() {
  const { user } = useAuth();
  const t = useT();
  // Only participants have an attempt to review; asking for anyone else is a guaranteed 404.
  const { data } = useQuizOverview(Boolean(user?.participant));
  if (!data?.attempt?.reviewAvailable) return null;
  return (
    <Button to="/quiz/review" variant="quiet" className="mt-2 self-start">
      {t.results.reviewYourAnswers}
    </Button>
  );
}
