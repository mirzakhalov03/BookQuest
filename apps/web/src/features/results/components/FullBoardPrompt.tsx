import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { formatCount } from '@/lib/format';
import { useT } from '@/i18n';

/** Signed out, only the podium is public; this says what's behind the sign-in. */
export function FullBoardPrompt({ finishedCount }: { finishedCount: number }) {
  const t = useT();
  return (
    <section className="flex flex-col items-start gap-3 rounded-box border border-[color:var(--rule)] p-4">
      <p className="type-label">{t.results.fullLeaderboard}</p>
      <p className="m-0 text-paper">{t.results.finishedPrompt(finishedCount, formatCount(finishedCount))}</p>
      <Button to="/me" className="group">
        <span>{t.common.signIn}</span>
        <ArrowIcon />
      </Button>
    </section>
  );
}
