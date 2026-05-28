import * as React from 'react';

import { cn } from '../../../lib/utils';
import type { EntryStatus } from '../../../types';

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
  const fg = `var(--octo-st-${status})`;
  const bg = `var(--octo-st-${status}-bg)`;
  const bd = `var(--octo-st-${status}-bd)`;

  if (variant === 'dot') {
    return (
      <span
        className={cn('octo-chip octo-chip--status octo-chip--status-dot', className)}
        style={{ fontSize: sz.fontSize }}
      >
        <span className="octo-chip__status-dot" style={{ background: fg }} />
        {info.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'octo-chip octo-chip--status',
        size === 'sm' ? 'octo-chip octo-chip--status-sm' : 'octo-chip octo-chip--status-md',
        className,
      )}
      style={{
        background: bg,
        color: fg,
        borderColor: bd,
      }}
    >
      <span className="octo-chip__status-dot" style={{ width: sz.dot, height: sz.dot, background: fg }} />
      {info.label}
    </span>
  );
}
