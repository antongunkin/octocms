'use client';

import * as React from 'react';
import { Bell, Check, GitCommit, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastCardTone = 'default' | 'success' | 'error' | 'warn' | 'info' | 'brand';

type ToastCardProps = {
  tone?: ToastCardTone;
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  time?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
};

const railClass: Record<ToastCardTone, string> = {
  default: 'bg-[var(--border-strong)]',
  success: 'bg-[var(--ok)]',
  error: 'bg-[var(--danger)]',
  warn: 'bg-[var(--st-changed)]',
  info: 'bg-[var(--accent)]',
  brand: 'bg-[var(--brand)]',
};

const chipClass: Record<ToastCardTone, string> = {
  default: 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-2)]',
  success: 'bg-[var(--ok-bg)] border-[var(--ok-bd)] text-[var(--ok)]',
  error: 'bg-[var(--danger-bg)] border-[var(--danger-bd)] text-[var(--danger)]',
  warn: 'bg-[var(--st-changed-bg)] border-[var(--st-changed-bd)] text-[var(--st-changed)]',
  info: 'bg-[var(--accent-bg)] border-[var(--border)] text-[var(--accent-fg)]',
  brand: 'bg-[var(--brand-bg)] border-[var(--brand)] text-[var(--brand-strong)]',
};

const defaultIcon: Record<ToastCardTone, React.ReactNode> = {
  default: <Bell className="h-3.5 w-3.5" />,
  success: <Check className="h-3.5 w-3.5" />,
  error: <TriangleAlert className="h-3.5 w-3.5" />,
  warn: <TriangleAlert className="h-3.5 w-3.5" />,
  info: <Info className="h-3.5 w-3.5" />,
  brand: <GitCommit className="h-3.5 w-3.5" />,
};

export function ToastCard({
  tone = 'default',
  icon,
  title,
  body,
  action,
  time,
  onDismiss,
  className,
}: ToastCardProps) {
  return (
    <div
      className={cn(
        'relative flex w-full min-w-[360px] max-w-[420px] items-start gap-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-1)] py-3 pl-3.5 pr-3 shadow-md',
        className,
      )}
    >
      <span aria-hidden className={cn('absolute left-0 top-0 bottom-0 w-[3px]', railClass[tone])} />
      <span
        className={cn(
          'inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg border',
          chipClass[tone],
        )}
      >
        {icon ?? defaultIcon[tone]}
      </span>
      <div className="min-w-0 flex-1 pt-px">
        <div className="flex items-baseline gap-2">
          <div className="flex-1 min-w-0 truncate text-sm font-semibold tracking-[-0.005em] text-[var(--text)]">
            {title}
          </div>
          {time && (
            <span className="flex-none font-mono text-[10px] text-[var(--muted)]">{time}</span>
          )}
        </div>
        {body && <div className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{body}</div>}
        {(action || onDismiss) && (
          <div className="mt-2 flex items-center gap-4">
            {action && (
              <button
                type="button"
                className="border-0 bg-transparent p-0 text-xs font-semibold text-[var(--text)] hover:underline cursor-pointer"
              >
                {action}
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="border-0 bg-transparent p-0 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        title="Close"
        onClick={onDismiss}
        className="-mr-0.5 -mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-md border-0 bg-transparent text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
