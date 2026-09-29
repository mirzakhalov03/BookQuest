import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
}

export function AdminPageHeader({ eyebrow, title, actions }: AdminPageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="type-label m-0">{eyebrow}</p>
        <h1 className="type-display m-0 break-words text-3xl text-paper">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
