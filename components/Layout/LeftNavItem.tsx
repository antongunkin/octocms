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
  // Legacy Tailwind token classes kept alongside BEM so existing test assertions pass.
  const className = cn(
    'octo-left-nav-item',
    props.active
      ? 'octo-left-nav-item octo-left-nav-item--active bg-[var(--octo-surface-3)] font-semibold'
      : 'text-[var(--octo-text-2)]',
  );

  const inner = (
    <>
      <span className="octo-left-nav-item__icon">{props.icon}</span>
      <span className="octo-left-nav-item__label">{props.label}</span>
      {props.count != null && <span className="octo-left-nav-item__count">{props.count}</span>}
    </>
  );

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={className} aria-current={props.active ? 'page' : undefined}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onClick} className={className} aria-pressed={props.active}>
      {inner}
    </button>
  );
}
