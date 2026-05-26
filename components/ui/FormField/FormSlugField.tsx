'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { sanitizeSlugFieldInputValue, slugifyForUrl } from '../../../lib/slugField';
import { Button } from '../Button/Button';

import { Field } from './Field';
import { FieldShell, FIELD_INPUT_CLASS } from './FieldShell';

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
    <Field label={label} htmlFor={name} schema="slug" required={required} hint={hint} error={error}>
      <div className="octo-ff-slug__row">
        <div className="octo-ff-slug__input-wrap">
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
        <Button type="button" variant="outline" onClick={onRegenerate}>
          Regenerate from title
        </Button>
      </div>
    </Field>
  );
};

export default FormSlugField;
