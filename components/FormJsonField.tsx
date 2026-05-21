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
      <span className="octo-ff-json__status--empty">
        {required ? 'Enter JSON…' : 'Optional — leave empty for no value'}
      </span>
    ) : status === 'valid' ? (
      <span className="octo-ff-json__status--valid">Valid JSON</span>
    ) : (
      <span className="octo-ff-json__status--invalid">Invalid JSON</span>
    );

  return (
    <div className="octo-form-field">
      <FieldLabel label={label} htmlFor={name} type="json" required={required} />
      <textarea
        id={name}
        className={cn(FIELD_TEXTAREA_CLASS, 'octo-ff-json__textarea', error && 'octo-textarea--error')}
        name={name}
        value={text}
        onChange={handleChange}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
      />
      <div className="octo-ff-json__status">{statusLine}</div>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormJsonField;
