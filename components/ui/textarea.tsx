import * as React from 'react';

import { cn } from '../../lib/utils';

export interface TextareaProps extends React.ComponentProps<'textarea'> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'field-textarea flex min-h-[108px] w-full rounded-2xl border border-border bg-surface-1 px-3 py-2 text-sm text-text shadow-[var(--shadow-1)] placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
