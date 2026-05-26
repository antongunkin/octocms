'use client';

import * as React from 'react';

import { cn } from '../../../lib/utils';
import { Icon } from '../Icon/Icon';

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  removable?: boolean;
  mono?: boolean;
  onRemove?: () => void;
};

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, children, removable, mono, onRemove, ...props }, ref) => (
    <span ref={ref} className={cn('octo-chip', mono && 'octo-chip octo-chip--mono', className)} {...props}>
      {children}
      {removable && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="octo-chip__remove">
          <Icon.X size={11} />
        </button>
      )}
    </span>
  ),
);
Chip.displayName = 'Chip';
