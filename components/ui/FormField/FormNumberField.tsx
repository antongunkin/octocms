'use client';

import React from 'react';

import { Field } from './Field';
import { FieldShell, FIELD_INPUT_CLASS } from './FieldShell';

type FormNumberFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number | 'any';
  valueType?: 'int' | 'float';
};

const FormNumberField = ({
  label,
  name,
  value,
  required,
  hint,
  error,
  min,
  max,
  step,
  valueType,
}: FormNumberFieldProps) => {
  const resolvedStep = step !== undefined ? step : valueType === 'int' ? 1 : 'any';

  return (
    <Field label={label} htmlFor={name} schema="number" required={required} hint={hint} error={error}>
      <FieldShell error={!!error} className="octo-ff-number__shell">
        <input
          id={name}
          className={FIELD_INPUT_CLASS}
          type="number"
          name={name}
          defaultValue={value}
          min={min}
          max={max}
          step={resolvedStep}
          aria-invalid={error ? true : undefined}
        />
      </FieldShell>
    </Field>
  );
};

export default FormNumberField;
