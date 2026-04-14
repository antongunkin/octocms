'use client';

import React from 'react';

import { storedDatetimeToFormInput, toDateInputValue, toDatetimeLocalValue } from '../lib/datetimeField';
import { cn } from '../lib/utils';

import { FieldHintAndError } from './FieldHintAndError';

type FormDatetimeFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  dateOnly?: boolean;
  defaultNow?: boolean;
};

const FormDatetimeField = ({
  label,
  name,
  value,
  required,
  hint,
  error,
  dateOnly,
  defaultNow,
}: FormDatetimeFieldProps) => {
  const isDateOnly = dateOnly === true;
  const fromStored = storedDatetimeToFormInput(value, isDateOnly);
  const fallbackNow =
    defaultNow === true && !fromStored
      ? isDateOnly
        ? toDateInputValue(new Date())
        : toDatetimeLocalValue(new Date())
      : undefined;
  const defaultValue = fromStored || fallbackNow || '';

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
        type={isDateOnly ? 'date' : 'datetime-local'}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
      />
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormDatetimeField;
