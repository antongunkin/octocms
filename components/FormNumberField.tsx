'use client';

import React from 'react';

import { FieldHintAndError } from './FieldHintAndError';
import { FieldLabel } from './FieldLabel';
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
    <div className="mb-5">
      <FieldLabel label={label} htmlFor={name} type="number" required={required} />
      <FieldShell error={!!error} className="max-w-md">
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
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormNumberField;
