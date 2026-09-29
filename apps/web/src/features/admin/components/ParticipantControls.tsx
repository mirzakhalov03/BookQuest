import { ArrowDown, ArrowUp } from 'lucide-react';

export type SortField = 'number' | 'name' | 'registered';
export type SortOrder = 'asc' | 'desc';

export interface ParticipantSort {
  field: SortField;
  order: SortOrder;
}

const SORT_FIELDS: { field: SortField; label: string; firstOrder: SortOrder }[] = [
  { field: 'number', label: 'Number', firstOrder: 'asc' },
  { field: 'name', label: 'Name', firstOrder: 'asc' },
  // Newest first is what anyone asking for "registered" means.
  { field: 'registered', label: 'Date', firstOrder: 'desc' }
];

interface ParticipantControlsProps {
  sort: ParticipantSort;
  onSortChange: (sort: ParticipantSort) => void;
}

/** Sort as quiet text links — the search stays the only boxed control. */
export function ParticipantControls({ sort, onSortChange }: ParticipantControlsProps) {
  const Arrow = sort.order === 'asc' ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-4">
      <span className="type-label shrink-0">Sort</span>
      {SORT_FIELDS.map(({ field, label, firstOrder }) => {
        const active = sort.field === field;
        return (
          <LinkButton
            key={field}
            active={active}
            // Tapping the active one flips it; tapping another starts at its natural direction.
            onClick={() =>
              onSortChange({
                field,
                order: active ? (sort.order === 'asc' ? 'desc' : 'asc') : firstOrder
              })
            }
          >
            {label}
            {active && <Arrow aria-hidden className="ml-0.5 inline h-3.5 w-3.5 -translate-y-px" />}
          </LinkButton>
        );
      })}
    </div>
  );
}

interface LinkButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function LinkButton({ active, onClick, children }: LinkButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`py-1.5 text-sm underline-offset-4 transition-colors ${
        active
          ? 'text-paper underline decoration-[color:var(--rule-strong)]'
          : 'text-taupe hover:text-paper'
      }`}
    >
      {children}
    </button>
  );
}
