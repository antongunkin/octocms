'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '../../lib/utils';
import { Kbd } from '../ui';

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</div>
      {children}
    </div>
  );
}

export type RowItemProps = {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  badge?: string;
  kbd?: string[];
  mono?: boolean;
  active?: boolean;
  /** When provided, the row renders as a `<Link>` so the browser owns navigation. */
  href?: string;
  onMouseEnter?: () => void;
  onClick?: (e: React.MouseEvent) => void;
};

const ROW_CLASSES = 'flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left no-underline';

export function RowItem({ icon, title, sub, badge, kbd, mono, active, href, onMouseEnter, onClick }: RowItemProps) {
  const inner = (
    <>
      <span className="flex-none text-[var(--muted)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-sm font-medium text-[var(--text)]', mono && 'font-mono')}>{title}</div>
        {sub && <div className="mt-0.5 truncate font-mono text-xs text-[var(--muted)]">{sub}</div>}
      </div>
      {badge && (
        <span className="rounded-[4px] bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
          {badge}
        </span>
      )}
      {kbd && (
        <span className="inline-flex gap-1">
          {kbd.map((k, i) => (
            <Kbd key={i}>{k}</Kbd>
          ))}
        </span>
      )}
    </>
  );

  const className = cn(ROW_CLASSES, active && 'bg-[var(--surface-2)]');

  if (href) {
    return (
      <Link href={href} className={className} onMouseEnter={onMouseEnter} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onMouseEnter={onMouseEnter} onClick={onClick}>
      {inner}
    </button>
  );
}
