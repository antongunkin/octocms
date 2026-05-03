'use client';

import React from 'react';

type FieldLabelProps = {
  label: string;
  htmlFor?: string;
  type?: string;
  required?: boolean;
  rightSlot?: React.ReactNode;
};

export function FieldLabel({ label, htmlFor, type, required, rightSlot }: FieldLabelProps) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground leading-none">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      {type ? <code className="font-mono text-[11px] text-muted-foreground/80 leading-none">{type}</code> : null}
      {rightSlot ? (
        <div className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">{rightSlot}</div>
      ) : null}
    </div>
  );
}
