'use client';

import React, { useState } from 'react';

import { cn } from '../lib/utils';

import { FieldHintAndError } from './FieldHintAndError';
import { FieldLabel } from './FieldLabel';

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
    <div className="octo-form-field">
      <FieldLabel label={label} type="boolean" required={required} />
      <input type="hidden" name={name} value={checked ? 'true' : 'false'} />
      <div className="octo-ff-boolean__track">
        <button
          type="button"
          onClick={() => setChecked(true)}
          className={cn(
            'octo-ff-boolean__seg',
            checked ? 'octo-ff-boolean__seg--active' : 'octo-ff-boolean__seg--inactive',
          )}
        >
          {trueLabel}
        </button>
        <button
          type="button"
          onClick={() => setChecked(false)}
          className={cn(
            'octo-ff-boolean__seg',
            !checked ? 'octo-ff-boolean__seg--active' : 'octo-ff-boolean__seg--inactive',
          )}
        >
          {falseLabel}
        </button>
      </div>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormBooleanField;
