import * as React from 'react';

import { cn } from '../../../lib/utils';
import { Icon } from '../Icon/Icon';

type PublishButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  count?: number;
  label?: string;
};

export const PublishButton = React.forwardRef<HTMLButtonElement, PublishButtonProps>(
  ({ className, count = 0, label = 'Publish', ...props }, ref) => (
    <button ref={ref} type="button" className={cn('octo-button octo-button--publish', className)} {...props}>
      <Icon.GitCommit size={13} />
      {label}
      {count > 0 && <span className="octo-button__publish-count">{count}</span>}
    </button>
  ),
);
PublishButton.displayName = 'PublishButton';
