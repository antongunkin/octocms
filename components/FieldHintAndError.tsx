'use client';

import React from 'react';

type FieldHintAndErrorProps = {
  hint?: string;
  error?: string;
};

/** Gray helper text and/or validation message below a field. */
export function FieldHintAndError({ hint, error }: FieldHintAndErrorProps) {
  if (!hint && !error) return null;

  return (
    <div className="octo-field-hint-error">
      {hint ? <p className="octo-field-hint-error__hint">{hint}</p> : null}
      {error ? <p className="octo-field-hint-error__error">{error}</p> : null}
    </div>
  );
}
