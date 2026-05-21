'use client';

import React from 'react';

import { storedDatetimeToFormInput, toDateInputValue, toDatetimeLocalValue } from '../lib/datetimeField';

import { FieldHintAndError } from './FieldHintAndError';
import { FieldLabel } from './FieldLabel';
import { FieldShell, FIELD_INPUT_CLASS } from './FieldShell';

type FormDatetimeFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  dateOnly?: boolean;
  defaultNow?: boolean;
};

const FormDatetimeField = ({
  label,
  name,
  value,
  required,
  hint,
  error,
  dateOnly,
  defaultNow,
}: FormDatetimeFieldProps) => {
  const isDateOnly = dateOnly === true;
  const fromStored = storedDatetimeToFormInput(value, isDateOnly);
  const fallbackNow =
    defaultNow === true && !fromStored
      ? isDateOnly
        ? toDateInputValue(new Date())
        : toDatetimeLocalValue(new Date())
      : undefined;
  const defaultValue = fromStored || fallbackNow || '';

  return (
    <div className="octo-form-field">
      <FieldLabel label={label} htmlFor={name} type={isDateOnly ? 'date' : 'datetime'} required={required} />
      <FieldShell error={!!error} className="octo-ff-datetime__shell">
        <input
          id={name}
          className={FIELD_INPUT_CLASS}
          type={isDateOnly ? 'date' : 'datetime-local'}
          name={name}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
        />
      </FieldShell>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormDatetimeField;
