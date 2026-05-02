import * as React from 'react';

import { cn } from '../../lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  inputPrefix?: React.ReactNode;
  inputSuffix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputPrefix, inputSuffix, ...props }, ref) => {
    if (inputPrefix || inputSuffix) {
      return (
        <div
          className={cn(
            'field-shell flex h-10 w-full items-center gap-2 rounded-full border border-border bg-surface-1 px-3 text-sm text-text shadow-[var(--shadow-1)]',
            className,
          )}
        >
          {inputPrefix ? <span className="inline-flex shrink-0 items-center text-muted">{inputPrefix}</span> : null}
          <input
            type={type}
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-text outline-none placeholder:text-muted"
            ref={ref}
            {...props}
          />
          {inputSuffix ? <span className="inline-flex shrink-0 items-center text-muted">{inputSuffix}</span> : null}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          'field-shell flex h-10 w-full rounded-full border border-border bg-surface-1 px-3 py-2 text-sm text-text shadow-[var(--shadow-1)] placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
