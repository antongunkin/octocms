'use client';

import * as React from 'react';

import { useControllableState } from '../../../hooks/useControllableState';
import { cn } from '../../../lib/utils';
import { Switcher, SwitcherItem } from '../Switcher/Switcher';

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

type TabsListProps = React.HTMLAttributes<HTMLDivElement>;

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(({ className, ...props }, ref) => {
  return <Switcher ref={ref} className={className} {...props} />;
});
TabsList.displayName = 'TabsList';

// ── TabsTrigger ───────────────────────────────────────────────────────────────

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled, onClick, ...props }, ref) => {
    const { activeValue, setActiveValue, triggerId, panelId } = React.useContext(TabsContext);
    const isActive = activeValue === value;

    return (
      <SwitcherItem
        ref={ref}
        active={isActive}
        disabled={disabled}
        id={triggerId(value)}
        aria-controls={panelId(value)}
        data-value={value}
        className={className}
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
