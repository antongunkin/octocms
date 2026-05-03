'use client';

import React from 'react';

import { cn } from '../lib/utils';

type FieldShellProps = {
  error?: boolean;
  className?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
};

/** Pill-shaped white surface that wraps a borderless input. Hover/focus states
 *  come from the `.field-shell` selector in globals.css. */
export function FieldShell({ error, className, prefix, suffix, children }: FieldShellProps) {
  return (
    <div
      className={cn(
        'field-shell flex h-10 w-full items-center gap-2 rounded-full border bg-card px-4',
        error ? 'border-destructive' : 'border-border',
        className,
      )}
    >
      {prefix ? <span className="shrink-0 text-[13px] text-muted-foreground">{prefix}</span> : null}
      <div className="flex-1 min-w-0">{children}</div>
      {suffix ? <span className="shrink-0 text-[13px] text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

export const FIELD_INPUT_CLASS =
  'h-9 w-full bg-transparent text-[14px] text-foreground border-0 outline-none focus:outline-none placeholder:text-muted-foreground';

export const FIELD_TEXTAREA_CLASS =
  'field-textarea w-full rounded-2xl border border-border bg-card px-4 py-3 text-[14px] text-foreground outline-none transition-colors hover:border-border-strong focus:outline-none placeholder:text-muted-foreground resize-y';
