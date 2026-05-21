'use client';

import React from 'react';

type FieldLabelProps = {
  label: string;
  htmlFor?: string;
  type?: string;
  required?: boolean;
  rightSlot?: React.ReactNode;
};

export function FieldLabel({ label, htmlFor, type, required, rightSlot }: FieldLabelProps) {
  return (
    <div className="octo-field-label">
      <label htmlFor={htmlFor} className="octo-field-label__text">
        {label}
        {required ? <span className="octo-field-label__required">*</span> : null}
      </label>
      {type ? <code className="octo-field-label__type">{type}</code> : null}
      {rightSlot ? <div className="octo-field-label__right">{rightSlot}</div> : null}
    </div>
  );
}
