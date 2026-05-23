'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';
import { Check, ChevronDown, ChevronUp } from './icons';
import { useComposedRefs } from '../../hooks/useComposedRefs';
import { useControllableState } from '../../hooks/useControllableState';
import { usePopoverContent } from '../../hooks/usePopoverContent';

// ─── helpers ─────────────────────────────────────────────────────────────────

// Scan the React element tree for SelectItem nodes and collect value→label pairs.
// Runs synchronously during render so SelectValue can display labels even when
// SelectContent has never been open (items haven't mounted yet).
function collectOptionLabels(children: React.ReactNode, labels: Map<string, string>) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as Record<string, unknown>;
    if ((child.type as { displayName?: string }).displayName === 'SelectItem' && typeof props.value === 'string') {
      const text =
        typeof props.children === 'string'
          ? props.children
          : props.children != null
            ? String(props.children)
            : props.value;
      labels.set(props.value as string, text as string);
    }
    if (props.children) collectOptionLabels(props.children as React.ReactNode, labels);
  });
}

// ─── context ─────────────────────────────────────────────────────────────────

type SelectCtx = {
  value: string;
  setValue: (v: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  disabled: boolean;
  contentId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  // map from option value → label text for SelectValue display
  optionLabels: React.RefObject<Map<string, string>>;
};

const SelectContext = React.createContext<SelectCtx | null>(null);

function useSelect() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error('Select compound components must be wrapped in <Select>');
  return ctx;
}

// ─── Root ────────────────────────────────────────────────────────────────────

type SelectProps = {
  children?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
};

function Select({
  children,
  value: valueProp,
  defaultValue = '',
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
}: SelectProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const contentId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const optionLabels = React.useRef<Map<string, string>>(new Map());

  // Scan the JSX tree for SelectItem nodes before any child renders so
  // SelectValue can display the correct label on the initial render.
  optionLabels.current.clear();
  collectOptionLabels(children, optionLabels.current);

  return (
    <SelectContext.Provider
      value={{
        value: value ?? '',
        setValue,
        open: open ?? false,
        setOpen,
        disabled,
        contentId,
        triggerRef,
        optionLabels,
      }}
    >
      <div style={{ position: 'relative' }}>{children}</div>
    </SelectContext.Provider>
  );
}

// ─── Trigger ─────────────────────────────────────────────────────────────────

type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, onClick, ...props }, ref) => {
    const { open, setOpen, contentId, triggerRef, disabled } = useSelect();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      setOpen(!open);
      onClick?.(e);
    };

    return (
      <button
        ref={(node) => {
          (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={contentId}
        disabled={disabled}
        className={cn('octo-select__trigger', className)}
        onClick={handleClick}
        {...props}
      >
        {children}
        <ChevronDown className="octo-select__chevron" />
      </button>
    );
  },
);
SelectTrigger.displayName = 'SelectTrigger';

// ─── Value ───────────────────────────────────────────────────────────────────

type SelectValueProps = { placeholder?: string; className?: string };

function SelectValue({ placeholder, className }: SelectValueProps) {
  const { value, optionLabels } = useSelect();
  const label = value ? (optionLabels.current.get(value) ?? value) : '';

  return (
    <span className={cn('octo-select__value', className)} data-placeholder={!value || undefined}>
      {label || placeholder}
    </span>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

type SelectContentProps = React.HTMLAttributes<HTMLDivElement> & {
  position?: 'popper' | 'item-aligned';
};

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, position = 'popper', ...props }, ref) => {
    const { open, setOpen, contentId, triggerRef, optionLabels } = useSelect();
    // Populate label map synchronously so SelectValue can display before content is open
    collectOptionLabels(children, optionLabels.current);
    const { contentRef } = usePopoverContent({ open, setOpen, triggerRef });
    const composedRef = useComposedRefs(contentRef, ref);

    // Arrow key navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const listbox = contentRef.current;
      if (!listbox) return;
      const options = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]:not([data-disabled])'));
      if (!options.length) return;
      const currentIdx = options.findIndex((el) => el.getAttribute('data-highlighted') === 'true');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIdx < options.length - 1 ? currentIdx + 1 : 0;
        options.forEach((el, i) => el.setAttribute('data-highlighted', String(i === next)));
        options[next].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = currentIdx > 0 ? currentIdx - 1 : options.length - 1;
        options.forEach((el, i) => el.setAttribute('data-highlighted', String(i === next)));
        options[next].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        options.forEach((el, i) => el.setAttribute('data-highlighted', String(i === 0)));
        options[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        options.forEach((el, i) => el.setAttribute('data-highlighted', String(i === options.length - 1)));
        options[options.length - 1].focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (currentIdx >= 0) options[currentIdx].click();
      }
    };

    if (!open) return null;

    return (
      <div
        ref={composedRef}
        id={contentId}
        role="listbox"
        data-state="open"
        className={cn('octo-select__content', position === 'popper' && 'octo-select__content--popper', className)}
        style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0 }}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <div className={cn('octo-select__viewport', position === 'popper' && 'octo-select__viewport--popper')}>
          {children}
        </div>
      </div>
    );
  },
);
SelectContent.displayName = 'SelectContent';

// ─── Item ─────────────────────────────────────────────────────────────────────

type SelectItemProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  disabled?: boolean;
};

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, disabled, onClick, ...props }, ref) => {
    const { value: selectedValue, setValue, setOpen, optionLabels } = useSelect();
    const isSelected = selectedValue === value;
    const labelRef = React.useRef<HTMLDivElement>(null);

    // Register label text for SelectValue display
    React.useEffect(() => {
      const labels = optionLabels.current;
      const text = labelRef.current?.textContent ?? String(children);
      labels.set(value, text);
      return () => {
        labels.delete(value);
      };
    }, [value, children, optionLabels]);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onClick?.(e);
      setValue(value);
      setOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
      }
    };

    return (
      <div
        ref={(node) => {
          (labelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        role="option"
        aria-selected={isSelected}
        data-state={isSelected ? 'checked' : 'unchecked'}
        data-disabled={disabled || undefined}
        className={cn('octo-select__item', className)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        {...props}
      >
        <span className="octo-select__item-indicator">{isSelected && <Check />}</span>
        {children}
      </div>
    );
  },
);
SelectItem.displayName = 'SelectItem';

// ─── Group ───────────────────────────────────────────────────────────────────

const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ ...props }, ref) => (
  <div ref={ref} role="group" {...props} />
));
SelectGroup.displayName = 'SelectGroup';

// ─── Label ────────────────────────────────────────────────────────────────────

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('octo-select__label', className)} {...props} />,
);
SelectLabel.displayName = 'SelectLabel';

// ─── Separator ───────────────────────────────────────────────────────────────

const SelectSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => <hr ref={ref} className={cn('octo-select__separator', className)} {...props} />,
);
SelectSeparator.displayName = 'SelectSeparator';

// ─── Scroll buttons (decorative — real scroll is CSS overflow: auto) ──────────

const SelectScrollUpButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('octo-select__scroll-btn', className)} aria-hidden {...props}>
      <ChevronUp />
    </div>
  ),
);
SelectScrollUpButton.displayName = 'SelectScrollUpButton';

const SelectScrollDownButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('octo-select__scroll-btn', className)} aria-hidden {...props}>
      <ChevronDown />
    </div>
  ),
);
SelectScrollDownButton.displayName = 'SelectScrollDownButton';

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
