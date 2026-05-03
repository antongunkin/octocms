'use client';

import React, { useEffect, useState } from 'react';

import type { SelectOption } from '../admin/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
      <div className="mb-5">
        <FieldLabel label={label} type="select" required={required} />
        <input type="hidden" name={name} value={JSON.stringify(multi)} />
        <ul className="mt-1 space-y-2 list-none p-0">
          {options.map((o) => (
            <li key={o.value}>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={multi.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="rounded border-border"
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
    <div className="mb-5">
      <FieldLabel label={label} type="select" required={required} />
      <input type="hidden" name={name} value={single} />
      <Select
        value={radixValue}
        onValueChange={(v) => {
          onClearError?.(name);
          setSingle(v === EMPTY_VALUE ? '' : v);
        }}
      >
        <SelectTrigger
          className="field-shell h-10 w-full max-w-md rounded-full border-border bg-card px-4"
          aria-invalid={error ? true : undefined}
        >
          <SelectValue placeholder={allowEmpty ? '—' : 'Choose…'} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? (
            <SelectItem value={EMPTY_VALUE}>
              <span className="text-muted-foreground">—</span>
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
