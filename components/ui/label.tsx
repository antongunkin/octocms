'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  ({ className, ...props }, ref) => <label ref={ref} className={cn('octo-label', className)} {...props} />,
);
Label.displayName = 'Label';
