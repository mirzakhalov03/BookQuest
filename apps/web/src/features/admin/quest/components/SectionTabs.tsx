import { useId, type ReactNode } from 'react';
import { AlertTriangle, type LucideIcon } from 'lucide-react';

export interface SectionTab<Id extends string> {
  id: Id;
  title: string;
  icon: LucideIcon;
  isDirty: boolean;
  hasError: boolean;
  content: ReactNode;
}

interface SectionTabsProps<Id extends string> {
  tabs: readonly SectionTab<Id>[];
  active: Id;
  onChange: (id: Id) => void;
}

/**
 * Icon tiles (the dashboard's quick-action look) that switch which group of
 * fields is showing. Every panel stays mounted (`hidden`), so switching never
 * unregisters fields.
 */
export function SectionTabs<Id extends string>({ tabs, active, onChange }: SectionTabsProps<Id>) {
  const baseId = useId();

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="grid grid-cols-5 gap-2 sm:gap-3">
        {tabs.map(({ id, title, icon: Icon, isDirty, hasError }) => {
          const selected = id === active;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${id}`}
              onClick={() => onChange(id)}
              className={`relative flex min-w-0 flex-col items-center gap-2 rounded-box border px-1 py-4 transition active:translate-y-px ${
                selected
                  ? 'border-amber/60 bg-ash-hi text-amber shadow-[0_2px_0_var(--color-void)]'
                  : 'border-[color:var(--rule)] text-taupe hover:text-paper'
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
              <span className="max-w-full truncate text-xs font-medium">{title}</span>
              {hasError ? (
                <AlertTriangle
                  aria-label="Has errors"
                  className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-error"
                />
              ) : isDirty ? (
                <span
                  aria-label="Unsaved changes"
                  className="absolute right-2 top-2 h-2 w-2 rounded-full bg-ember"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {tabs.map(({ id, content }) => (
        <div
          key={id}
          role="tabpanel"
          id={`${baseId}-panel-${id}`}
          aria-labelledby={`${baseId}-tab-${id}`}
          hidden={id !== active}
          className="flex flex-col gap-4 pb-6"
        >
          {content}
        </div>
      ))}
    </div>
  );
}
