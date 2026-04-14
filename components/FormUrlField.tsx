'use client';

import React from 'react';

import { cn } from '../lib/utils';

import { FieldHintAndError } from './FieldHintAndError';

type FormUrlFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (fieldName: string) => void;
};

const FormUrlField = ({ label, name, value, required, hint, error, onClearError }: FormUrlFieldProps) => {
  return (
    <div className="mb-6">
      <div className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </div>
      <input
        className={cn(
          'w-full text-sm bg-background text-foreground px-3 py-2 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors',
          error && 'border-destructive focus:ring-destructive/30',
        )}
        type="text"
        inputMode="url"
        autoComplete="url"
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        onChange={() => onClearError?.(name)}
      />
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormUrlField;
