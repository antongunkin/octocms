'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';
import { Check, ChevronRight } from './icons';
import { Slot } from './Slot';
import { useComposedRefs } from '../../hooks/useComposedRefs';
import { useControllableState } from '../../hooks/useControllableState';
import { usePopoverContent, type PopoverAlign } from '../../hooks/usePopoverContent';

// ─── context ─────────────────────────────────────────────────────────────────

type DropdownMenuCtx = {
  open: boolean;
  setOpen: (next: boolean) => void;
  contentId: string;
  triggerRef: React.RefObject<HTMLElement | null>;
};

const DropdownMenuContext = React.createContext<DropdownMenuCtx | null>(null);

function useDropdownMenu() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error('DropdownMenu compound components must be wrapped in <DropdownMenu>');
  return ctx;
}

// ─── Root ────────────────────────────────────────────────────────────────────

type DropdownMenuProps = {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function DropdownMenu({ children, open: openProp, defaultOpen = false, onOpenChange }: DropdownMenuProps) {
  const [open, setOpen] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const contentId = React.useId();
  const triggerRef = React.useRef<HTMLElement | null>(null);

  return (
    <DropdownMenuContext.Provider value={{ open: open ?? false, setOpen, contentId, triggerRef }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>{children}</div>
    </DropdownMenuContext.Provider>
  );
}

// ─── Trigger ─────────────────────────────────────────────────────────────────

type DropdownMenuTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
};

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ asChild, children, onClick, ...props }, ref) => {
    const { open, setOpen, contentId, triggerRef } = useDropdownMenu();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(!open);
      onClick?.(e);
    };

    // Keyboard activation: Enter/Space toggle the menu (mirrors browser native
    // button activation, which fireEvent.keyDown does not simulate in jsdom).
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(!open);
      }
    };

    const sharedProps = {
      'aria-haspopup': 'menu' as const,
      'aria-expanded': open,
      'aria-controls': contentId,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
    };

    if (asChild && React.isValidElement(children)) {
      return (
        <Slot
          ref={(node: HTMLElement | null) => {
            (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
            if (typeof ref === 'function') ref(node as HTMLButtonElement | null);
            else if (ref) ref.current = node as HTMLButtonElement | null;
          }}
          {...sharedProps}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={(node) => {
          (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type="button"
        {...sharedProps}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

// ─── Content ─────────────────────────────────────────────────────────────────

type DropdownMenuContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: PopoverAlign;
  sideOffset?: number;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ align = 'start', sideOffset = 4, className, children, ...props }, ref) => {
    const { open, setOpen, contentId, triggerRef } = useDropdownMenu();
    const { contentRef } = usePopoverContent({ open, setOpen, triggerRef });
    const composedRef = useComposedRefs(contentRef, ref);

    // Arrow key navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const menu = contentRef.current;
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
      if (!items.length) return;

      const currentIdx = items.findIndex((el) => el.getAttribute('data-highlighted') === 'true');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
        items.forEach((el, i) => el.setAttribute('data-highlighted', String(i === next)));
        items[next].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
        items.forEach((el, i) => el.setAttribute('data-highlighted', String(i === next)));
        items[next].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items.forEach((el, i) => el.setAttribute('data-highlighted', String(i === 0)));
        items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items.forEach((el, i) => el.setAttribute('data-highlighted', String(i === items.length - 1)));
        items[items.length - 1].focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (currentIdx >= 0) items[currentIdx].click();
      }
    };

    if (!open) return null;

    const alignStyle: React.CSSProperties =
      align === 'end'
        ? { right: 0, left: 'auto' }
        : align === 'center'
          ? { left: '50%', transform: 'translateX(-50%)' }
          : { left: 0, right: 'auto' };

    return (
      <div
        ref={composedRef}
        id={contentId}
        role="menu"
        data-state="open"
        className={cn('octo-dropdown__content', className)}
        style={{ position: 'absolute', top: `calc(100% + ${sideOffset}px)`, ...alignStyle }}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    );
  },
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

// ─── Item ─────────────────────────────────────────────────────────────────────

type DropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  inset?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
};

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, inset, onSelect, disabled, onClick, ...props }, ref) => {
    const { setOpen } = useDropdownMenu();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onClick?.(e);
      onSelect?.();
      setOpen(false);
    };

    return (
      <button
        ref={ref}
        role="menuitem"
        type="button"
        data-disabled={disabled || undefined}
        className={cn('octo-dropdown__item', inset && 'octo-dropdown__item octo-dropdown__item--inset', className)}
        onClick={handleClick}
        tabIndex={-1}
        {...props}
      />
    );
  },
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

// ─── CheckboxItem ────────────────────────────────────────────────────────────

type DropdownMenuCheckboxItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onSelect?: () => void;
};

const DropdownMenuCheckboxItem = React.forwardRef<HTMLButtonElement, DropdownMenuCheckboxItemProps>(
  ({ className, children, checked = false, onCheckedChange, onSelect, ...props }, ref) => {
    const { setOpen } = useDropdownMenu();

    const handleClick = () => {
      onCheckedChange?.(!checked);
      onSelect?.();
      setOpen(false);
    };

    return (
      <button
        ref={ref}
        role="menuitemcheckbox"
        type="button"
        aria-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        className={cn('octo-dropdown__item', 'octo-dropdown__item octo-dropdown__item--checkable', className)}
        onClick={handleClick}
        tabIndex={-1}
        {...props}
      >
        <span className="octo-dropdown__indicator">{checked && <Check className="octo-dropdown__check-icon" />}</span>
        {children}
      </button>
    );
  },
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

// ─── RadioGroup / RadioItem ──────────────────────────────────────────────────

type DropdownMenuRadioGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  onValueChange?: (value: string) => void;
};

const RadioGroupContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void }>({});

function DropdownMenuRadioGroup({ value, onValueChange, children, ...props }: DropdownMenuRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div role="group" {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

type DropdownMenuRadioItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
  onSelect?: () => void;
};

const DropdownMenuRadioItem = React.forwardRef<HTMLButtonElement, DropdownMenuRadioItemProps>(
  ({ className, children, value, onSelect, ...props }, ref) => {
    const { value: groupValue, onValueChange } = React.useContext(RadioGroupContext);
    const { setOpen } = useDropdownMenu();
    const checked = groupValue === value;

    const handleClick = () => {
      onValueChange?.(value);
      onSelect?.();
      setOpen(false);
    };

    return (
      <button
        ref={ref}
        role="menuitemradio"
        type="button"
        aria-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        className={cn('octo-dropdown__item', 'octo-dropdown__item octo-dropdown__item--checkable', className)}
        onClick={handleClick}
        tabIndex={-1}
        {...props}
      >
        <span className="octo-dropdown__indicator">
          {checked && (
            <svg className="octo-dropdown__radio-dot" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="2" />
            </svg>
          )}
        </span>
        {children}
      </button>
    );
  },
);
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

// ─── Label ────────────────────────────────────────────────────────────────────

type DropdownMenuLabelProps = React.HTMLAttributes<HTMLDivElement> & { inset?: boolean };

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('octo-dropdown__label', inset && 'octo-dropdown__label octo-dropdown__label--inset', className)}
      {...props}
    />
  ),
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

// ─── Separator ───────────────────────────────────────────────────────────────

const DropdownMenuSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => <hr ref={ref} className={cn('octo-dropdown__separator', className)} {...props} />,
);
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

// ─── Shortcut ────────────────────────────────────────────────────────────────

function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('octo-dropdown__shortcut', className)} {...props} />;
}
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

// ─── Group ───────────────────────────────────────────────────────────────────

function DropdownMenuGroup({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="group" {...props} />;
}
DropdownMenuGroup.displayName = 'DropdownMenuGroup';

// ─── Portal (no-op — content renders via internal Portal already) ─────────────

function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
DropdownMenuPortal.displayName = 'DropdownMenuPortal';

// ─── Sub-menu (stubs — not actively used in the codebase) ────────────────────

type DropdownMenuSubProps = { children?: React.ReactNode; open?: boolean; onOpenChange?: (v: boolean) => void };

function DropdownMenuSub({ children }: DropdownMenuSubProps) {
  return <>{children}</>;
}

type DropdownMenuSubTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean };

const DropdownMenuSubTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuSubTriggerProps>(
  ({ className, inset, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn('octo-dropdown__sub-trigger', inset && 'octo-dropdown__item octo-dropdown__item--inset', className)}
      {...props}
    >
      {children}
      <ChevronRight className="octo-dropdown__sub-chevron" />
    </button>
  ),
);
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

const DropdownMenuSubContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="menu" className={cn('octo-dropdown__content', className)} {...props} />
  ),
);
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
