'use client';

import * as React from 'react';

import { cn } from '../../../lib/utils';

function useSwitcherKeyboardNav(onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>) {
  return (e: React.KeyboardEvent<HTMLDivElement>) => {
    const list = e.currentTarget;
    const triggers = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
    if (triggers.length === 0) {
      onKeyDown?.(e);
      return;
    }

    const currentIdx = triggers.findIndex((el) => el === document.activeElement);
    let nextIdx = currentIdx;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIdx = (currentIdx + 1) % triggers.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIdx = (currentIdx - 1 + triggers.length) % triggers.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIdx = triggers.length - 1;
    } else {
      onKeyDown?.(e);
      return;
    }

    const next = triggers[nextIdx];
    if (next) {
      next.focus();
      next.click();
    }
    onKeyDown?.(e);
  };
}

type SwitcherProps = React.HTMLAttributes<HTMLDivElement>;

const Switcher = React.forwardRef<HTMLDivElement, SwitcherProps>(
  ({ className, onKeyDown, children, ...props }, ref) => {
    const handleKeyDown = useSwitcherKeyboardNav(onKeyDown);

    return (
      <div ref={ref} role="tablist" className={cn('octo-switcher', className)} onKeyDown={handleKeyDown} {...props}>
        {React.Children.toArray(children)}
      </div>
    );
  },
);
Switcher.displayName = 'Switcher';

type SwitcherItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: boolean;
};

const SwitcherItem = React.forwardRef<HTMLButtonElement, SwitcherItemProps>(
  ({ className, active = false, icon = false, disabled, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        role="tab"
        aria-selected={active}
        data-state={active ? 'active' : 'inactive'}
        disabled={disabled}
        {...(disabled ? { 'data-disabled': '' } : {})}
        className={cn('octo-switcher__item', icon && 'octo-switcher__item--icon', className)}
        {...props}
      />
    );
  },
);
SwitcherItem.displayName = 'SwitcherItem';

export { Switcher, SwitcherItem };
