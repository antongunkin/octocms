'use client';

import React from 'react';

import { Field } from './Field';
import { FieldShell, FIELD_INPUT_CLASS } from './FieldShell';

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
    <Field label={label} htmlFor={name} schema="url" required={required} hint={hint} error={error}>
      <FieldShell error={!!error}>
        <input
          id={name}
          className={FIELD_INPUT_CLASS}
          type="text"
          inputMode="url"
          autoComplete="url"
          name={name}
          defaultValue={value}
          aria-invalid={error ? true : undefined}
          onChange={() => onClearError?.(name)}
        />
      </FieldShell>
    </Field>
  );
};

export default FormUrlField;
