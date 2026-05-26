import * as React from 'react';

import { cn } from '../../../lib/utils';

export const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => (
    <kbd ref={ref} className={cn('octo-chip octo-chip--kbd', className)} {...props}>
      {children}
    </kbd>
  ),
);
Kbd.displayName = 'Kbd';
