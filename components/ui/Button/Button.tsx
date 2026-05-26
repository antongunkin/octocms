import * as React from 'react';

import { cn } from '../../../lib/utils';
import { Slot } from '../Slot/Slot';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'primary' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'brand';
  size?: 'default' | 'lg' | 'icon';
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export function buttonVariants({
  variant = 'default',
  size = 'default',
  className,
}: {
  variant?: string;
  size?: string;
  className?: string;
} = {}): string {
  return cn(
    'octo-button',
    variant && `octo-button--${variant}`,
    size && size !== 'default' && `octo-button--${size}`,
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, icon, iconRight, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const cls = buttonVariants({ variant, size, className });

    if (asChild && React.isValidElement(children)) {
      const onlyChild = React.Children.only(children) as React.ReactElement<{ children?: React.ReactNode }>;
      const slotChildren = (
        <>
          {icon ? <span className="octo-button__icon">{icon}</span> : null}
          {onlyChild.props.children}
          {iconRight ? <span className="octo-button__icon">{iconRight}</span> : null}
        </>
      );
      const mergedChild = React.cloneElement(onlyChild, undefined, slotChildren);
      return (
        <Comp className={cls} ref={ref} {...props}>
          {mergedChild}
        </Comp>
      );
    }

    return (
      <Comp className={cls} ref={ref} {...props}>
        {icon ? <span className="octo-button__icon">{icon}</span> : null}
        {children}
        {iconRight ? <span className="octo-button__icon">{iconRight}</span> : null}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
