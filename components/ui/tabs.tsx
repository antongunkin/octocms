'use client';

import * as React from 'react';

import { useControllableState } from '../../hooks/useControllableState';
import { cn } from '../../lib/utils';

// ── Context ───────────────────────────────────────────────────────────────────

type TabsContextValue = {
  activeValue: string | undefined;
  setActiveValue: (value: string) => void;
  triggerId: (value: string) => string;
  panelId: (value: string) => string;
};

const TabsContext = React.createContext<TabsContextValue>({
  activeValue: undefined,
  setActiveValue: () => {},
  triggerId: (v) => v,
  panelId: (v) => v,
});

// ── Tabs (root) ───────────────────────────────────────────────────────────────

type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, defaultValue, onValueChange, className, children, ...props }, ref) => {
    const [activeValue, setActiveValue] = useControllableState({
      value,
      defaultValue,
      onChange: onValueChange,
    });

    const uid = React.useId();
    const ctx = React.useMemo(
      () => ({
        activeValue,
        setActiveValue: (next: string) => {
          if (next !== activeValue) setActiveValue(next);
        },
        triggerId: (v: string) => `${uid}-trigger-${v}`,
        panelId: (v: string) => `${uid}-panel-${v}`,
      }),
      [activeValue, setActiveValue, uid],
    );

    return (
      <TabsContext.Provider value={ctx}>
        <div ref={ref} className={cn(className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = 'Tabs';

// ── TabsList ──────────────────────────────────────────────────────────────────

type TabsListProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'pill';
};

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, variant = 'default', onKeyDown, ...props }, ref) => {
    const { setActiveValue } = React.useContext(TabsContext);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const list = e.currentTarget;
      const triggers = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
      if (triggers.length === 0) return;

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
        const value = next.getAttribute('data-value');
        if (value) setActiveValue(value);
      }
      onKeyDown?.(e);
    };

    return (
      <div
        ref={ref}
        role="tablist"
        className={cn('octo-tabs__list', variant === 'pill' && 'octo-tabs__list octo-tabs__list--pill', className)}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  },
);
TabsList.displayName = 'TabsList';

// ── TabsTrigger ───────────────────────────────────────────────────────────────

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
  variant?: 'default' | 'pill';
};

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, variant = 'default', disabled, onClick, ...props }, ref) => {
    const { activeValue, setActiveValue, triggerId, panelId } = React.useContext(TabsContext);
    const isActive = activeValue === value;

    return (
      <button
        ref={ref}
        role="tab"
        id={triggerId(value)}
        aria-selected={isActive}
        aria-controls={panelId(value)}
        data-state={isActive ? 'active' : 'inactive'}
        data-value={value}
        disabled={disabled}
        {...(disabled ? { 'data-disabled': '' } : {})}
        className={cn(
          'octo-tabs__trigger',
          variant === 'pill' && 'octo-tabs__trigger octo-tabs__trigger--pill',
          className,
        )}
        onClick={(e) => {
          setActiveValue(value);
          onClick?.(e);
        }}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = 'TabsTrigger';

// ── TabsContent ───────────────────────────────────────────────────────────────

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
};

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(({ className, value, ...props }, ref) => {
  const { activeValue, panelId, triggerId } = React.useContext(TabsContext);
  if (activeValue !== value) return null;

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={panelId(value)}
      aria-labelledby={triggerId(value)}
      data-state="active"
      className={cn('octo-tabs__content', className)}
      tabIndex={0}
      {...props}
    />
  );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
