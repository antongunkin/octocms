import * as React from 'react';
import { GitBranch, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

type BranchChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  name: string;
  ahead?: number;
  dirty?: number;
  /**
   * When true, show the dropdown chevron and full emphasis even on the base branch
   * (e.g. `main`) so the chip reads as an openable menu trigger.
   */
  menuTrigger?: boolean;
};

export const BranchChip = React.forwardRef<HTMLButtonElement, BranchChipProps>(
  ({ className, name, ahead = 0, dirty = 0, disabled, menuTrigger, ...props }, ref) => {
    const isFeature = !disabled && (menuTrigger || name !== 'main');
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          'focus-ring inline-flex h-8 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 font-mono text-xs font-medium text-[var(--text)]',
          isFeature ? 'cursor-pointer' : 'cursor-default text-[var(--muted)] opacity-60',
          className,
        )}
        {...props}
      >
        <GitBranch size={13} style={{ color: isFeature ? 'var(--brand-strong)' : undefined }} />
        <span className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
        {ahead > 0 && (
          <span
            className="rounded-[4px] border px-1.5 font-mono text-[10px] font-semibold leading-4"
            style={{
              color: 'var(--st-changed)',
              background: 'var(--st-changed-bg)',
              borderColor: 'var(--st-changed-bd)',
            }}
          >
            +{ahead}
          </span>
        )}
        {dirty > 0 && <span className="text-[var(--muted)]">· {dirty}</span>}
        {isFeature && <ChevronDown size={11} className="ml-px opacity-55" />}
      </button>
    );
  },
);
BranchChip.displayName = 'BranchChip';
