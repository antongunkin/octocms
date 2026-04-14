'use client';

import React, { useEffect, useState } from 'react';

import { normalizeHexColor } from '../lib/colorField';
import { cn } from '../lib/utils';

import { FieldHintAndError } from './FieldHintAndError';

const PICKER_FALLBACK = '#000000';

type FormColorFieldProps = {
  label: string;
  name: string;
  value: string;
  allowInput?: boolean;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (fieldName: string) => void;
};

const FormColorField = ({
  label,
  name,
  value,
  allowInput,
  required,
  hint,
  error,
  onClearError,
}: FormColorFieldProps) => {
  const normalizedInitial = normalizeHexColor(String(value).trim()) ?? '';
  const [hex, setHex] = useState(normalizedInitial);
  const [hexDraft, setHexDraft] = useState(normalizedInitial);

  useEffect(() => {
    const next = normalizeHexColor(String(value).trim()) ?? '';
    setHex(next);
    setHexDraft(next);
  }, [value]);

  const applyHex = (next: string) => {
    setHex(next);
    setHexDraft(next);
    onClearError?.(name);
  };

  const onPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyHex(e.target.value.toLowerCase());
  };

  const onHexBlur = () => {
    const trimmed = hexDraft.trim();
    if (!trimmed) {
      if (!required) {
        applyHex('');
      } else {
        setHexDraft(hex);
      }
      return;
    }
    const n = normalizeHexColor(trimmed);
    if (n) {
      applyHex(n);
    } else {
      setHexDraft(hex);
    }
  };

  return (
    <div className="mb-6">
      <div className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          className={cn('h-10 w-14 cursor-pointer rounded border border-border bg-layout-bg p-1')}
          value={hex || PICKER_FALLBACK}
          onChange={onPickerChange}
          aria-invalid={error ? true : undefined}
          aria-label={`${label} color picker`}
        />
        {allowInput ? (
          <input
            type="text"
            className={cn(
              'text-sm bg-background text-foreground px-3 py-2 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors max-w-[11rem] font-mono',
              error && 'border-destructive focus:ring-destructive/30',
            )}
            value={hexDraft}
            onChange={(e) => {
              setHexDraft(e.target.value);
              onClearError?.(name);
            }}
            onBlur={onHexBlur}
            placeholder="#aabbcc"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-label={`${label} hex value`}
          />
        ) : null}
      </div>
      <input type="hidden" name={name} value={hex} />
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormColorField;
