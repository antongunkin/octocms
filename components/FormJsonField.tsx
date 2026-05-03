'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '../lib/utils';

import { FieldHintAndError } from './FieldHintAndError';
import { FieldLabel } from './FieldLabel';
import { FIELD_TEXTAREA_CLASS } from './FieldShell';

type FormJsonFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (name: string) => void;
};

function syntaxStatus(text: string): 'empty' | 'valid' | 'invalid' {
  const t = text.trim();
  if (t === '') return 'empty';
  try {
    JSON.parse(t);
    return 'valid';
  } catch {
    return 'invalid';
  }
}

const FormJsonField = ({ label, name, value, required, hint, error, onClearError }: FormJsonFieldProps) => {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);
  const status = useMemo(() => syntaxStatus(text), [text]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      onClearError?.(name);
    },
    [name, onClearError],
  );

  const statusLine =
    status === 'empty' ? (
      <span className="text-muted-foreground text-sm">
        {required ? 'Enter JSON…' : 'Optional — leave empty for no value'}
      </span>
    ) : status === 'valid' ? (
      <span className="text-sm text-green-600 light:text-green-700">Valid JSON</span>
    ) : (
      <span className="text-destructive text-sm">Invalid JSON</span>
    );

  return (
    <div className="mb-5">
      <FieldLabel label={label} htmlFor={name} type="json" required={required} />
      <textarea
        id={name}
        className={cn(FIELD_TEXTAREA_CLASS, 'min-h-[160px] font-mono leading-relaxed', error && 'border-destructive')}
        name={name}
        value={text}
        onChange={handleChange}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
      />
      <div className="mt-1.5">{statusLine}</div>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormJsonField;
