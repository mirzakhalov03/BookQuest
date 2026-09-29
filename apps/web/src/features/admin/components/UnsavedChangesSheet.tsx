import type { Blocker } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

export function UnsavedChangesSheet({ blocker }: { blocker: Blocker }) {
  return (
    <Sheet
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title="Discard your changes?"
      actions={
        <>
          <Button type="button" variant="quiet" onClick={() => blocker.reset?.()}>
            Keep editing
          </Button>
          <Button type="button" onClick={() => blocker.proceed?.()}>
            Discard
          </Button>
        </>
      }
    >
      <p className="m-0 text-taupe">These edits aren't saved yet. Leaving now throws them away.</p>
    </Sheet>
  );
}
