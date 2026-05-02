import * as React from 'react';
import { cn } from '../../lib/utils';

export const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        'inline-flex min-w-[18px] justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 font-mono text-[10px] font-medium text-[var(--muted)]',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  ),
);
Kbd.displayName = 'Kbd';
