'use client';

import React from 'react';

import { cn } from '../lib/utils';

import { FieldHintAndError } from './FieldHintAndError';

const DEFAULT_ROWS = 4;

type FormTextFieldProps = {
  label: string;
  name: string;
  value: string;
  rows?: number;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (fieldName: string) => void;
};

const FormTextField = ({
  label,
  name,
  value,
  rows = DEFAULT_ROWS,
  required,
  hint,
  error,
  onClearError,
}: FormTextFieldProps) => {
  return (
    <div className="mb-6">
      <div className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </div>
      <textarea
        className={cn(
          'w-full text-sm bg-background text-foreground px-3 py-2 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors',
          error && 'border-destructive focus:ring-destructive/30',
        )}
        name={name}
        rows={rows}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        onChange={() => onClearError?.(name)}
      />
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormTextField;
