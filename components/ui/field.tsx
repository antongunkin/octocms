import * as React from 'react';
import { Lock, X } from 'lucide-react';
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
    <div className={cn('flex flex-col', className)}>
      <div className="mb-1.5 flex items-baseline gap-2">
        <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--text)]">
          {label}
          {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
        </label>
        {schema && <code className="font-mono text-[10px] text-[var(--muted)]">{schema}</code>}
        {locked && (
          <span title="Locked" className="inline-flex text-[var(--muted)]">
            <Lock size={12} />
          </span>
        )}
        {dirty && (
          <span
            className="rounded-[4px] border px-2 font-mono text-[10px] font-medium"
            style={{
              color: 'var(--st-changed)',
              background: 'var(--st-changed-bg)',
              borderColor: 'var(--st-changed-bd)',
            }}
          >
            ~ modified
          </span>
        )}
        <div className="flex-1" />
        {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
      </div>
      {helper && <p className="mb-2 text-xs leading-relaxed text-[var(--muted)]">{helper}</p>}
      {children}
      {error && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--danger)]">
          <X size={11} />
          {error}
        </div>
      )}
    </div>
  );
}
