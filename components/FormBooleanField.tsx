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

  const segBase =
    'h-8 px-4 text-[13px] font-medium rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

  return (
    <div className="mb-5">
      <FieldLabel label={label} type="boolean" required={required} />
      <input type="hidden" name={name} value={checked ? 'true' : 'false'} />
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setChecked(true)}
          className={cn(segBase, checked ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted/40')}
        >
          {trueLabel}
        </button>
        <button
          type="button"
          onClick={() => setChecked(false)}
          className={cn(segBase, !checked ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted/40')}
        >
          {falseLabel}
        </button>
      </div>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormBooleanField;
