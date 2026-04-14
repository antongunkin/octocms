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
    <div className="mt-1.5 space-y-1">
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
