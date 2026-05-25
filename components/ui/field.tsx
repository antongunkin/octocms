import * as React from 'react';
import { Icon } from './icons';
import { cn } from '../../lib/utils';

type FieldProps = {
  label: React.ReactNode;
  hint?: React.ReactNode;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  schema?: React.ReactNode;
  required?: boolean;
  locked?: boolean;
  dirty?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
};

export function Field({
  label,
  hint,
  helper,
  error,
  schema,
  required,
  locked,
  dirty,
  htmlFor,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn('octo-field', className)}>
      <div className="octo-field__header">
        <label htmlFor={htmlFor} className="octo-field__label">
          {label}
          {required && <span className="octo-field__required">*</span>}
        </label>
        {schema && <code className="octo-field__schema">{schema}</code>}
        {locked && (
          <span title="Locked" className="octo-field__lock">
            <Icon.Lock size={12} />
          </span>
        )}
        {dirty && <span className="octo-field__dirty">~ modified</span>}
        <div className="octo-field__spacer" />
        {hint && <span className="octo-field__hint">{hint}</span>}
      </div>
      {helper && <p className="octo-field__helper">{helper}</p>}
      {children}
      {error && (
        <div className="octo-field__error">
          <Icon.X size={11} />
          {error}
        </div>
      )}
    </div>
  );
}
