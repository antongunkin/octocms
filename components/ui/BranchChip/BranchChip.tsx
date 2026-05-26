import * as React from 'react';

import { cn } from '../../../lib/utils';
import { Icon } from '../Icon/Icon';

type BranchChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  name: string;
  ahead?: number;
  dirty?: number;
  /** When true, show dropdown chevron and full emphasis even on base branch */
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
          'octo-button octo-button--branch',
          !isFeature && 'octo-button octo-button--branch-disabled',
          className,
        )}
        {...props}
      >
        <Icon.GitBranch size={13} style={{ color: isFeature ? 'var(--brand-strong)' : undefined }} />
        <span className="octo-button__branch-name">{name}</span>
        {ahead > 0 && <span className="octo-button__branch-ahead">+{ahead}</span>}
        {dirty > 0 && <span className="octo-button__branch-dirty">· {dirty}</span>}
        {isFeature && <Icon.ChevronDown size={11} style={{ marginLeft: 1, opacity: 0.55 }} />}
      </button>
    );
  },
);
BranchChip.displayName = 'BranchChip';
