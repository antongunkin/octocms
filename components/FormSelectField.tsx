'use client';

import React, { useEffect, useState } from 'react';

import type { SelectOption } from '../admin/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui';

import { FieldHintAndError } from './FieldHintAndError';
import { FieldLabel } from './FieldLabel';

const EMPTY_VALUE = '__cms_select_none__';

function normalizeMulti(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

type FormSelectFieldProps = {
  label: string;
  name: string;
  value: unknown;
  options: readonly SelectOption[];
  multiple: boolean;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (fieldName: string) => void;
};

const FormSelectField = ({
  label,
  name,
  value,
  options,
  multiple,
  required,
  hint,
  error,
  onClearError,
}: FormSelectFieldProps) => {
  const [multi, setMulti] = useState<string[]>(() => normalizeMulti(value));
  const [single, setSingle] = useState(() => (value == null || value === '' ? '' : String(value)));

  useEffect(() => {
    setMulti(normalizeMulti(value));
  }, [value]);

  useEffect(() => {
    setSingle(value == null || value === '' ? '' : String(value));
  }, [value]);

  if (multiple) {
    const toggle = (val: string) => {
      onClearError?.(name);
      setMulti((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
    };

    return (
      <div className="octo-form-field">
        <FieldLabel label={label} type="select" required={required} />
        <input type="hidden" name={name} value={JSON.stringify(multi)} />
        <ul className="octo-ff-select__multi">
          {options.map((o) => (
            <li key={o.value}>
              <label className="octo-ff-select__multi-label">
                <input
                  type="checkbox"
                  checked={multi.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="octo-ff-select__multi-checkbox"
                />
                <span>{o.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <FieldHintAndError hint={hint} error={error} />
      </div>
    );
  }

  const allowEmpty = !required;
  const radixValue: string | undefined = allowEmpty
    ? single === ''
      ? EMPTY_VALUE
      : single
    : single === ''
      ? undefined
      : single;

  return (
    <div className="octo-form-field">
      <FieldLabel label={label} type="select" required={required} />
      <input type="hidden" name={name} value={single} />
      <Select
        value={radixValue}
        onValueChange={(v) => {
          onClearError?.(name);
          setSingle(v === EMPTY_VALUE ? '' : v);
        }}
      >
        <SelectTrigger className="field-shell octo-input octo-input--shell" aria-invalid={error ? true : undefined}>
          <SelectValue placeholder={allowEmpty ? '—' : 'Choose…'} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? (
            <SelectItem value={EMPTY_VALUE}>
              <span className="octo-field-hint-error__hint">—</span>
            </SelectItem>
          ) : null}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormSelectField;
