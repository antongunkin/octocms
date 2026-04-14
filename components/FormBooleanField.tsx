'use client';

import React, { useState } from 'react';

import { FieldHintAndError } from './FieldHintAndError';

const DEFAULT_TRUE = 'Yes';
const DEFAULT_FALSE = 'No';

type FormBooleanFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  trueLabel?: string;
  falseLabel?: string;
};

const FormBooleanField = ({
  label,
  name,
  value,
  required,
  hint,
  error,
  trueLabel = DEFAULT_TRUE,
  falseLabel = DEFAULT_FALSE,
}: FormBooleanFieldProps) => {
  const [checked, setChecked] = useState(value === 'true');

  return (
    <div className="mb-6">
      <fieldset className="border-0 p-0 m-0">
        <legend className="block text-xs font-medium text-muted-foreground mb-1.5">
          {label}
          {required ? <span className="text-destructive ml-1">*</span> : null}
        </legend>
        <input type="hidden" name={name} value={checked ? 'true' : 'false'} />
        <input type="radio" id={`${name}_true`} value="true" checked={checked} onChange={() => setChecked(true)} />
        <label htmlFor={`${name}_true`}>{trueLabel}</label>{' '}
        <input type="radio" id={`${name}_false`} value="false" checked={!checked} onChange={() => setChecked(false)} />
        <label htmlFor={`${name}_false`}>{falseLabel}</label>
      </fieldset>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormBooleanField;
