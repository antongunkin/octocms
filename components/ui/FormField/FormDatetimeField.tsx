'use client';

import React from 'react';

import { storedDatetimeToFormInput, toDateInputValue, toDatetimeLocalValue } from '../../../lib/datetimeField';

import { Field } from './Field';
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
    <Field
      label={label}
      htmlFor={name}
      schema={isDateOnly ? 'date' : 'datetime'}
      required={required}
      hint={hint}
      error={error}
    >
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
    </Field>
  );
};

export default FormDatetimeField;
