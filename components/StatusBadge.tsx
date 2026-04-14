import React from 'react';
import { cn } from '../lib/utils';
import type { EntryStatus } from '../types';

const statusConfig: Record<EntryStatus, { label: string; dotClass: string; badgeClass: string }> = {
  draft: {
    label: 'Draft',
    dotClass: 'bg-yellow-400 dark:bg-yellow-500',
    badgeClass:
      'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-400 dark:border-yellow-800/60',
  },
  published: {
    label: 'Published',
    dotClass: 'bg-green-500 dark:bg-green-400',
    badgeClass:
      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-400 dark:border-green-800/60',
  },
  changed: {
    label: 'Changed',
    dotClass: 'bg-yellow-500 dark:bg-yellow-400',
    badgeClass:
      'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-400 dark:border-yellow-800/60',
  },
  archived: {
    label: 'Archived',
    dotClass: 'bg-gray-400 dark:bg-gray-500',
    badgeClass:
      'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700/60',
  },
  merged: {
    label: 'Merged',
    dotClass: 'bg-purple-500 dark:bg-purple-400',
    badgeClass:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-400 dark:border-purple-800/60',
  },
};

type StatusBadgeProps = {
  status: EntryStatus;
  variant?: 'badge' | 'dot';
  className?: string;
};

export function StatusBadge({ status, variant = 'badge', className }: StatusBadgeProps) {
  const cfg = statusConfig[status] || statusConfig.merged;

  if (variant === 'dot') {
    return (
      <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', cfg.dotClass, className)} title={cfg.label} />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        cfg.badgeClass,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
      {cfg.label}
    </span>
  );
}
