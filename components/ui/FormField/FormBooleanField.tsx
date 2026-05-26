'use client';

import React, { useState } from 'react';

import { cn } from '../../../lib/utils';

import { Field } from './Field';

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
    <Field label={label} schema="boolean" required={required} hint={hint} error={error}>
      <input type="hidden" name={name} value={checked ? 'true' : 'false'} />
      <div className="octo-ff-boolean__track">
        <button
          type="button"
          aria-pressed={checked}
          onClick={() => setChecked(true)}
          className={cn(
            'octo-ff-boolean__seg',
            checked
              ? 'octo-ff-boolean__seg octo-ff-boolean__seg--active'
              : 'octo-ff-boolean__seg octo-ff-boolean__seg--inactive',
          )}
        >
          {trueLabel}
        </button>
        <button
          type="button"
          aria-pressed={!checked}
          onClick={() => setChecked(false)}
          className={cn(
            'octo-ff-boolean__seg',
            !checked
              ? 'octo-ff-boolean__seg octo-ff-boolean__seg--active'
              : 'octo-ff-boolean__seg octo-ff-boolean__seg--inactive',
          )}
        >
          {falseLabel}
        </button>
      </div>
    </Field>
  );
};

export default FormBooleanField;
