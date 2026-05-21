import * as React from 'react';

import { cn } from '../../lib/utils';

export interface TextareaProps extends React.ComponentProps<'textarea'> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return <textarea ref={ref} className={cn('octo-textarea field-textarea', className)} {...props} />;
});
Textarea.displayName = 'Textarea';

export { Textarea };
