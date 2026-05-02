import * as React from 'react';
import { cn } from '../../lib/utils';

type Tone = 'info' | 'warn' | 'success' | 'danger' | 'brand';

type BannerProps = {
  tone?: Tone;
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

const toneClass: Record<Tone, string> = {
  info: 'border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text)] [&_.banner-icon]:text-[var(--text-2)]',
  warn: 'border-[var(--st-changed-bd)] bg-[var(--st-changed-bg)] text-[var(--st-changed)] [&_.banner-icon]:text-[var(--st-changed)]',
  success: 'border-[var(--ok-bd)] bg-[var(--ok-bg)] text-[var(--ok)] [&_.banner-icon]:text-[var(--ok)]',
  danger: 'border-[var(--danger-bd)] bg-[var(--danger-bg)] text-[var(--danger)] [&_.banner-icon]:text-[var(--danger)]',
  brand: 'border-[var(--brand)] bg-[var(--brand-bg)] text-[var(--brand-fg)] [&_.banner-icon]:text-[var(--brand-fg)]',
};

export function Banner({ tone = 'info', icon, title, body, action, className }: BannerProps) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', toneClass[tone], className)}>
      {icon && <span className="banner-icon inline-flex flex-none">{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold">{title}</div>
        {body && <div className="mt-0.5 text-xs leading-relaxed opacity-85">{body}</div>}
      </div>
      {action}
    </div>
  );
}
