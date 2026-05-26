import * as React from 'react';

import { cn } from '../../../lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  inputPrefix?: React.ReactNode;
  inputSuffix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputPrefix, inputSuffix, ...props }, ref) => {
    if (inputPrefix || inputSuffix) {
      return (
        <div className={cn('octo-input octo-input--shell field-shell', className)}>
          {inputPrefix ? <span className="octo-input__affix">{inputPrefix}</span> : null}
          <input type={type} className="octo-input__inner" ref={ref} {...props} />
          {inputSuffix ? <span className="octo-input__affix">{inputSuffix}</span> : null}
        </div>
      );
    }

    return <input type={type} className={cn('octo-input', className)} ref={ref} {...props} />;
  },
);
Input.displayName = 'Input';

export { Input };
