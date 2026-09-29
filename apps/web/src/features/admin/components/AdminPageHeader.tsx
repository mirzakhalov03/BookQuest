import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  eyebrow?: string;
  title?: string;
  titleClassName?: string;
  actions?: ReactNode;
}

export function AdminPageHeader({
  eyebrow,
  title,
  titleClassName = 'text-3xl',
  actions
}: AdminPageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <p className="type-label m-0">{eyebrow}</p>}
        {title && (
          <h1 className={`type-display m-0 break-words text-paper ${titleClassName}`}>{title}</h1>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
