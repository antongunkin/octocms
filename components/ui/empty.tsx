import * as React from 'react';
import { cn } from '../../lib/utils';

type EmptyProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  cta?: React.ReactNode;
  className?: string;
};

export function Empty({ icon, title, body, cta, className }: EmptyProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-1)] px-6 py-11 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--muted)]">
          {icon}
        </div>
      )}
      <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
      {body && (
        <div className="mx-auto mt-1.5 mb-4 max-w-[380px] text-xs leading-relaxed text-[var(--muted)]">{body}</div>
      )}
      {cta}
    </div>
  );
}
