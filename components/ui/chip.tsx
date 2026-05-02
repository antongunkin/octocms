import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  removable?: boolean;
  mono?: boolean;
  onRemove?: () => void;
};

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, children, removable, mono, onRemove, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-2)]',
        mono && 'font-mono',
        className,
      )}
      {...props}
    >
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="cursor-pointer opacity-60 hover:opacity-100"
        >
          <X size={11} />
        </button>
      )}
    </span>
  ),
);
Chip.displayName = 'Chip';
