import * as React from 'react';
import { cn } from '../../lib/utils';
import type { EntryStatus } from '../../types';

type StatusInfo = {
  label: string;
  desc: string;
};

export const STATUSES: Record<EntryStatus, StatusInfo> = {
  draft: { label: 'Draft', desc: 'Not yet committed' },
  changed: { label: 'Changed', desc: 'Unpublished edits on a feature branch' },
  published: { label: 'Published', desc: 'Live on main' },
  merged: { label: 'Merged', desc: 'PR merged into main' },
  archived: { label: 'Archived', desc: 'Removed from listing' },
};

type StatusBadgeProps = {
  status: EntryStatus;
  variant?: 'badge' | 'dot';
  size?: 'sm' | 'md';
  className?: string;
};

const sizeStyles = {
  sm: { padding: '2px 8px', fontSize: 11, dot: 6 },
  md: { padding: '4px 10px', fontSize: 12, dot: 6 },
};

export function StatusBadge({ status, variant = 'badge', size = 'md', className }: StatusBadgeProps) {
  const info = STATUSES[status];
  if (!info) return null;
  const sz = sizeStyles[size];
  const fg = `var(--st-${status})`;
  const bg = `var(--st-${status}-bg)`;
  const bd = `var(--st-${status}-bd)`;

  if (variant === 'dot') {
    return (
      <span
        className={cn('inline-flex items-center gap-2 text-[var(--text-2)]', className)}
        style={{ fontSize: sz.fontSize }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: fg }} />
        {info.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium leading-tight tabular-nums',
        className,
      )}
      style={{
        padding: sz.padding,
        fontSize: sz.fontSize,
        background: bg,
        color: fg,
        borderColor: bd,
      }}
    >
      <span className="rounded-full" style={{ width: sz.dot, height: sz.dot, background: fg }} />
      {info.label}
    </span>
  );
}
