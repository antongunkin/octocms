import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-[var(--border-strong)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]',
        secondary: 'border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text)] hover:bg-[var(--surface-2)]',
        ghost: 'bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]',
        link: 'text-primary underline-offset-4 hover:underline',
        brand: 'bg-brand text-brand-fg hover:bg-brand/90',
      },
      size: {
        default: 'h-9 gap-2 px-4 text-sm',
        sm: 'h-[30px] gap-1.5 px-3 text-sm',
        md: 'h-9 gap-2 px-4 text-sm',
        lg: 'h-11 gap-2 px-5 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, icon, iconRight, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    if (asChild && React.isValidElement(children)) {
      const onlyChild = React.Children.only(children) as React.ReactElement<{ children?: React.ReactNode }>;
      const slotChildren = (
        <>
          {icon ? <span className="inline-flex items-center">{icon}</span> : null}
          {onlyChild.props.children}
          {iconRight ? <span className="inline-flex items-center">{iconRight}</span> : null}
        </>
      );
      const mergedChild = React.cloneElement(onlyChild, undefined, slotChildren);

      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {mergedChild}
        </Comp>
      );
    }

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {icon ? <span className="inline-flex items-center">{icon}</span> : null}
        {children}
        {iconRight ? <span className="inline-flex items-center">{iconRight}</span> : null}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
