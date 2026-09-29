import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface SaveBarProps {
  visible: boolean;
  summary: string;
  tone?: 'neutral' | 'bad';
  submitLabel: string;
  busyLabel: string;
  isBusy: boolean;
  disabled: boolean;
  /** The bar sits outside the <form>, so Save submits it by id. */
  formId: string;
  onDiscard: () => void;
  discardLabel?: string;
  children?: ReactNode;
}

/** Pinned above the tab bar and present only while there is something to save. */
export function SaveBar({
  visible,
  summary,
  tone = 'neutral',
  submitLabel,
  busyLabel,
  isBusy,
  disabled,
  formId,
  onDiscard,
  discardLabel = 'Discard',
  children
}: SaveBarProps) {
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      aria-hidden={!visible}
      inert={!visible}
      className={`admin-savebar ${visible ? 'is-on' : ''}`}
    >
      <p aria-live="polite" className={`m-0 flex-1 text-sm ${tone === 'bad' ? 'text-error' : 'text-paper-dim'}`}>
        {summary}
      </p>
      {children}
      <Button type="button" variant="quiet" onClick={onDiscard} className="min-h-11 px-3">
        {discardLabel}
      </Button>
      <Button type="submit" form={formId} disabled={disabled} className="min-h-11 px-5">
        {isBusy ? busyLabel : submitLabel}
      </Button>
    </div>
  );
}
