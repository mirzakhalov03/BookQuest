import type { Blocker } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useT } from '@/i18n';

export function UnsavedChangesSheet({ blocker }: { blocker: Blocker }) {
  const t = useT().admin;
  return (
    <Sheet
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title={t.discardTitle}
      actions={
        <>
          <Button type="button" variant="quiet" onClick={() => blocker.reset?.()}>
            {t.keepEditing}
          </Button>
          <Button type="button" onClick={() => blocker.proceed?.()}>
            {t.discard}
          </Button>
        </>
      }
    >
      <p className="m-0 text-taupe">{t.discardBody}</p>
    </Sheet>
  );
}
