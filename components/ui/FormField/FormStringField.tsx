'use client';

import React from 'react';

import { Field } from './Field';
import { FieldShell, FIELD_INPUT_CLASS } from './FieldShell';

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
    <Field label={label} htmlFor={name} schema="string" required={required} hint={hint} error={error}>
      <FieldShell error={!!error}>
        <input
          id={name}
          className={FIELD_INPUT_CLASS}
          type="text"
          name={name}
          defaultValue={value}
          aria-invalid={error ? true : undefined}
        />
      </FieldShell>
    </Field>
  );
};

export default FormStringField;
