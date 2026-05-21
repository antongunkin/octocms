'use client';

import React from 'react';

import { FieldHintAndError } from './FieldHintAndError';
import { FieldLabel } from './FieldLabel';
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
    <div className="octo-form-field">
      <FieldLabel label={label} htmlFor={name} type="url" required={required} />
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
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormUrlField;
