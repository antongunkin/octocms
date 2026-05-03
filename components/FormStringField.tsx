'use client';

import React from 'react';

import { FieldHintAndError } from './FieldHintAndError';
import { FieldLabel } from './FieldLabel';
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
    <div className="mb-5">
      <FieldLabel label={label} htmlFor={name} type="string" required={required} />
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
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormStringField;
