import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';

interface AccountRowProps {
  icon: LucideIcon;
  children: ReactNode;
  /** A route renders a link with a chevron; otherwise it's a button for an in-place action. */
  to?: string;
  onClick?: () => void;
}

const ROW_CLASSES =
  'flex min-h-[3.25rem] w-full items-center gap-3 px-4 text-left text-base text-paper-dim transition-colors hover:bg-ash-hi hover:text-paper';

/** One line of the account list at the foot of `/me` — quiet, so it never outranks the pass. */
export function AccountRow({ icon: Icon, children, to, onClick }: AccountRowProps) {
  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-taupe" strokeWidth={1.8} aria-hidden="true" />
      <span className="flex-1">{children}</span>
      {to && <ChevronRight className="h-4 w-4 text-taupe-dim" aria-hidden="true" />}
    </>
  );

  return to ? (
    <Link to={to} className={ROW_CLASSES}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={ROW_CLASSES}>
      {content}
    </button>
  );
}

/** Groups rows into one rounded, hairline-divided panel. */
export function AccountList({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-[color:var(--rule)] overflow-hidden rounded-box border border-[color:var(--rule)] bg-ash/60">
      {children}
    </div>
  );
}
