'use client';

import React from 'react';

import { cn } from '../../../lib/utils';

import { Field } from './Field';
import { FIELD_TEXTAREA_CLASS } from './FieldShell';

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
    <Field label={label} htmlFor={name} schema="text" required={required} hint={hint} error={error}>
      <textarea
        id={name}
        className={cn(FIELD_TEXTAREA_CLASS, error && 'octo-textarea octo-textarea--error')}
        name={name}
        rows={rows}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        onChange={() => onClearError?.(name)}
      />
    </Field>
  );
};

export default FormTextField;
