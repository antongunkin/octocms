'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '../lib/utils';

import { FieldHintAndError } from './FieldHintAndError';

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
      <span className="text-sm text-green-700 dark:text-green-600">Valid JSON</span>
    ) : (
      <span className="text-destructive text-sm">Invalid JSON</span>
    );

  return (
    <div className="mb-6">
      <div className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </div>
      <textarea
        className={cn(
          'w-full bg-background text-foreground px-3 py-2 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors min-h-[160px] resize-y font-mono text-sm leading-relaxed',
          error && 'border-destructive focus:ring-destructive/30',
        )}
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
