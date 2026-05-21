'use client';

import React, { useEffect, useState } from 'react';

import { normalizeHexColor } from '../lib/colorField';
import { cn } from '../lib/utils';

import { FieldHintAndError } from './FieldHintAndError';
import { FieldLabel } from './FieldLabel';
import { FieldShell, FIELD_INPUT_CLASS } from './FieldShell';

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
    <div className="octo-form-field">
      <FieldLabel label={label} type="color" required={required} />
      <div className="octo-ff-color__row">
        <input
          type="color"
          className="octo-ff-color__picker"
          value={hex || PICKER_FALLBACK}
          onChange={onPickerChange}
          aria-invalid={error ? true : undefined}
          aria-label={`${label} color picker`}
        />
        {allowInput ? (
          <div className="octo-ff-color__input-wrap">
            <FieldShell error={!!error}>
              <input
                type="text"
                className={cn(FIELD_INPUT_CLASS, 'octo-ff-color__hex-input')}
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
            </FieldShell>
          </div>
        ) : null}
      </div>
      <input type="hidden" name={name} value={hex} />
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormColorField;
