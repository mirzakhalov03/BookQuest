import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { formatCount } from '@/lib/format';
import type { ChangeLine } from '../review';

interface ReviewChangesSheetProps {
  open: boolean;
  lines: ChangeLine[];
  participantCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReviewChangesSheet({ open, lines, participantCount, onConfirm, onCancel }: ReviewChangesSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title="Change a live quest?"
      actions={
        <>
          <Button type="button" variant="quiet" onClick={onCancel}>
            Keep editing
          </Button>
          <Button type="button" onClick={onConfirm}>
            Save changes
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
      <p className="m-0 text-sm text-taupe">
        {formatCount(participantCount)} {participantCount === 1 ? 'participant sees' : 'participants see'} this straight away.
      </p>
    </Sheet>
  );
}
