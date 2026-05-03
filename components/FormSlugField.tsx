'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { sanitizeSlugFieldInputValue, slugifyForUrl } from '../lib/slugField';

import { FieldHintAndError } from './FieldHintAndError';
import { FieldLabel } from './FieldLabel';
import { FieldShell, FIELD_INPUT_CLASS } from './FieldShell';
import { Button } from './ui/button';

type FormSlugFieldProps = {
  label: string;
  name: string;
  value: string;
  sourceField: string;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (fieldName: string) => void;
};

const FormSlugField = ({
  label,
  name,
  value,
  sourceField,
  required,
  hint,
  error,
  onClearError,
}: FormSlugFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [slugTouched, setSlugTouched] = useState(() => Boolean(value?.trim()));

  const applyFromSource = useCallback(
    (sourceText: string) => {
      if (!inputRef.current || slugTouched) {
        return;
      }
      inputRef.current.value = slugifyForUrl(sourceText);
    },
    [slugTouched],
  );

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.closest('form');
    if (!form || !input) {
      return undefined;
    }

    const onFormInput = (e: Event) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement)) {
        return;
      }
      if (t.name !== sourceField) {
        return;
      }
      applyFromSource(t.value);
    };

    form.addEventListener('input', onFormInput);
    return () => form.removeEventListener('input', onFormInput);
  }, [sourceField, applyFromSource]);

  const onSlugInput = (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const next = sanitizeSlugFieldInputValue(el.value);
    if (el.value !== next) {
      el.value = next;
    }
    setSlugTouched(true);
    onClearError?.(name);
  };

  const onRegenerate = () => {
    const form = inputRef.current?.closest('form');
    if (!form) {
      return;
    }
    const source = form.elements.namedItem(sourceField);
    const raw = source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement ? source.value : '';
    setSlugTouched(false);
    if (inputRef.current) {
      inputRef.current.value = slugifyForUrl(raw);
    }
    onClearError?.(name);
  };

  return (
    <div className="mb-5">
      <FieldLabel label={label} htmlFor={name} type="slug" required={required} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <FieldShell error={!!error}>
            <input
              ref={inputRef}
              id={name}
              className={FIELD_INPUT_CLASS}
              type="text"
              name={name}
              defaultValue={value}
              aria-invalid={error ? true : undefined}
              onInput={onSlugInput}
              onChange={onSlugInput}
            />
          </FieldShell>
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onRegenerate}>
          Regenerate from title
        </Button>
      </div>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormSlugField;
