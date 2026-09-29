import { useId, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';

interface EditorSectionProps {
  title: string;
  summary: string;
  isDirty: boolean;
  hasError: boolean;
  defaultOpen: boolean;
  children: ReactNode;
}

/**
 * A collapsible group whose header says what's inside, so a one-field fix is
 * one tap away. The body stays mounted (`hidden`), so collapsing never
 * unregisters fields, and an error keeps the section open.
 */
export function EditorSection({ title, summary, isDirty, hasError, defaultOpen, children }: EditorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = open || hasError;
  const bodyId = useId();

  return (
    <section className="border-b border-[color:var(--rule)]">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setOpen(!isOpen)}
        className="flex min-h-14 w-full items-center gap-3 py-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-label">{title}</span>
          <span className="truncate text-sm text-paper-dim">{summary}</span>
        </span>
        {hasError ? (
          <AlertTriangle aria-label="Has errors" className="h-4 w-4 shrink-0 text-error" />
        ) : isDirty ? (
          <span aria-label="Unsaved changes" className="h-2 w-2 shrink-0 rounded-full bg-ember" />
        ) : null}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-taupe transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div id={bodyId} hidden={!isOpen} className="flex flex-col gap-4 pb-6">
        {children}
      </div>
    </section>
  );
}
