import * as React from 'react';
import { cn } from '../../lib/utils';

export type TabsPillItem = {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
};

type TabsPillProps = {
  items: TabsPillItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';
  className?: string;
};

export function TabsPill({ items, value, onChange, variant = 'pill', className }: TabsPillProps) {
  if (variant === 'underline') {
    return (
      <div className={cn('flex gap-6 border-b border-[var(--border)]', className)}>
        {items.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={cn(
                'focus-ring -mb-px inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent px-0 py-2.5 text-sm font-medium',
                active ? 'border-b-2 text-[var(--text)] font-semibold' : 'text-[var(--muted)]',
              )}
              style={{
                borderBottom: active ? '2px solid var(--text)' : '2px solid transparent',
              }}
            >
              {t.icon}
              {t.label}
              {t.count != null && (
                <span className="rounded-[4px] bg-[var(--surface-2)] px-1.5 font-mono text-[10px] text-[var(--muted)]">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5',
        className,
      )}
    >
      {items.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'focus-ring inline-flex h-7 cursor-pointer items-center gap-2 rounded-full border-0 px-3.5 text-xs',
              active ? 'font-semibold text-[var(--text)]' : 'font-medium text-[var(--text-2)]',
            )}
            style={{
              background: active ? 'var(--surface-1)' : 'transparent',
              boxShadow: active ? 'var(--shadow-1)' : 'none',
            }}
          >
            {t.icon}
            {t.label}
            {t.count != null && <span className="font-mono text-[10px] text-[var(--muted)]">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
