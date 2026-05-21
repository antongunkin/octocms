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
    <div className={cn('field-shell octo-input--shell', error && 'octo-input--shell--error', className)}>
      {prefix ? <span className="octo-input__affix">{prefix}</span> : null}
      <div className="octo-input__inner-wrap" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
      {suffix ? <span className="octo-input__affix">{suffix}</span> : null}
    </div>
  );
}

export const FIELD_INPUT_CLASS = 'octo-input__inner';

export const FIELD_TEXTAREA_CLASS = 'field-textarea octo-textarea';
