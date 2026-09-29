import { useEffect, useId, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** Buttons, primary last — they stack primary-on-top on phones. */
  actions?: ReactNode;
}

/**
 * Native `<dialog>`: focus trap, Esc and an inert page behind it come from the
 * browser. A bottom sheet on phones, a centred dialog from `sm` up (`.sheet`).
 */
export function Sheet({ open, onClose, title, children, actions }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // The inner div fills the dialog, so a click landing on the dialog itself is the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="sheet"
    >
      <div className="flex flex-col gap-4 p-5 pb-[calc(1.25rem+var(--safe-b))]">
        <h2 id={titleId} className="type-display m-0 text-xl text-paper">
          {title}
        </h2>
        {children}
        {actions && <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>}
      </div>
    </dialog>
  );
}
