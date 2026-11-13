import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { formatCount } from '@/lib/format';
import type { ChangeLine } from '../review';
import { useT } from '@/i18n';

interface ReviewChangesSheetProps {
  open: boolean;
  lines: ChangeLine[];
  participantCount: number;
  /** Before launch nobody has seen the quest, so the "live" framing would be wrong. */
  isUpcoming: boolean;
  /** This save reveals the book: offer to announce it right after. */
  revealing: boolean;
  onConfirm: (announce: boolean) => void;
  onCancel: () => void;
}

export function ReviewChangesSheet({
  open,
  lines,
  participantCount,
  isUpcoming,
  revealing,
  onConfirm,
  onCancel
}: ReviewChangesSheetProps) {
  const { admin, adminQuest } = useT();
  const t = adminQuest.review;
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={isUpcoming ? t.titleUpcoming : t.titleLive}
      actions={
        <>
          <Button type="button" variant="quiet" onClick={onCancel}>
            {admin.keepEditing}
          </Button>
          {revealing && (
            <Button type="button" variant="quiet" onClick={() => onConfirm(true)}>
              {t.saveAndAnnounce}
            </Button>
          )}
          <Button type="button" onClick={() => onConfirm(false)}>
            {t.save}
          </Button>
        </>
      }
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {lines.map((line) => (
          <li key={line.label} className="flex flex-col gap-0.5">
            <span className="type-label">{line.label}</span>
            <span className="text-sm text-taupe line-through">{line.before}</span>
            <span className="text-paper">{line.after}</span>
          </li>
        ))}
      </ul>
      {revealing && <p className="m-0 text-sm text-paper-dim">{t.revealNudge}</p>}
      {!isUpcoming && (
        <p className="m-0 text-sm text-taupe">
          {t.seenAtOnce(participantCount, formatCount(participantCount))}
        </p>
      )}
    </Sheet>
  );
}
