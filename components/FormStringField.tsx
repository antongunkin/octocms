'use client';

import React from 'react';

import { cn } from '../lib/utils';

import { FieldHintAndError } from './FieldHintAndError';

type FormStringFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
};

const FormStringField = ({ label, name, value, required, hint, error }: FormStringFieldProps) => {
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
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
      />
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormStringField;
