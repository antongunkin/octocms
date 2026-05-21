import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { GitCommit, GitBranch, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'primary' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'brand';
  size?: 'default' | 'sm' | 'md' | 'lg' | 'icon';
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

// ── PublishButton ─────────────────────────────────────────────────────────────

type PublishButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  count?: number;
  label?: string;
  size?: 'sm' | 'md';
};

export const PublishButton = React.forwardRef<HTMLButtonElement, PublishButtonProps>(
  ({ className, count = 0, label = 'Publish', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn('octo-button octo-button--publish', className)}
      style={size === 'md' ? { height: '32px' } : undefined}
      {...props}
    >
      <GitCommit size={13} />
      {label}
      {count > 0 && <span className="octo-button__publish-count">{count}</span>}
    </button>
  ),
);
PublishButton.displayName = 'PublishButton';

// ── BranchChip ───────────────────────────────────────────────────────────────

type BranchChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  name: string;
  ahead?: number;
  dirty?: number;
  /** When true, show dropdown chevron and full emphasis even on base branch */
  menuTrigger?: boolean;
};

export const BranchChip = React.forwardRef<HTMLButtonElement, BranchChipProps>(
  ({ className, name, ahead = 0, dirty = 0, disabled, menuTrigger, ...props }, ref) => {
    const isFeature = !disabled && (menuTrigger || name !== 'main');
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn('octo-button octo-button--branch', !isFeature && 'octo-button--branch-disabled', className)}
        {...props}
      >
        <GitBranch size={13} style={{ color: isFeature ? 'var(--brand-strong)' : undefined }} />
        <span className="octo-button__branch-name">{name}</span>
        {ahead > 0 && <span className="octo-button__branch-ahead">+{ahead}</span>}
        {dirty > 0 && <span className="octo-button__branch-dirty">· {dirty}</span>}
        {isFeature && <ChevronDown size={11} style={{ marginLeft: 1, opacity: 0.55 }} />}
      </button>
    );
  },
);
BranchChip.displayName = 'BranchChip';
