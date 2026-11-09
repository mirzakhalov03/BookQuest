import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';

/** Signed out, only the podium is public; this says what's behind the sign-in. */
export function FullBoardPrompt({ finishedCount }: { finishedCount: number }) {
  return (
    <section className="flex flex-col items-start gap-3 rounded-box border border-[color:var(--rule)] p-4">
      <p className="type-label">Full leaderboard</p>
      <p className="m-0 text-paper">
        {finishedCount} {finishedCount === 1 ? 'reader' : 'readers'} finished the quiz. Sign in to see
        the full leaderboard and your rank.
      </p>
      <Button to="/me" className="group">
        <span>Sign in</span>
        <ArrowIcon />
      </Button>
    </section>
  );
}
