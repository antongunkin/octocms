'use client';

import Link from 'next/link';
import React from 'react';

import { cn } from '../../lib/utils';

type CommonProps = {
  icon: React.ReactNode;
  label: string;
  /** Optional tabular numeric count rendered on the right side of the row. */
  count?: number;
  active: boolean;
};

type LinkProps = CommonProps & { href: string; onClick?: never };
type ButtonProps = CommonProps & { href?: never; onClick: () => void };

export type LeftNavItemProps = LinkProps | ButtonProps;

export function LeftNavItem(props: LeftNavItemProps) {
  const className = cn(
    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors w-full text-left',
    props.active
      ? 'bg-[var(--surface-3)] font-semibold text-foreground'
      : 'text-[var(--text-2)] hover:bg-[var(--surface-1)]',
  );

  const inner = (
    <>
      <span className={cn('shrink-0', props.active ? 'text-foreground' : 'text-muted-foreground')}>{props.icon}</span>
      <span className="flex-1 truncate">{props.label}</span>
      {props.count != null && (
        <span className={cn('text-xs tabular-nums', props.active ? 'text-foreground/60' : 'text-muted-foreground')}>
          {props.count}
        </span>
      )}
    </>
  );

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onClick} className={className}>
      {inner}
    </button>
  );
}
