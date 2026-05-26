'use client';

import * as React from 'react';
import Link from 'next/link';

import { Kbd } from '../ui';

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="octo-cmdk__section">
      <div className="octo-cmdk__section-label">{label}</div>
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

export function RowItem({ icon, title, sub, badge, kbd, mono, active, href, onMouseEnter, onClick }: RowItemProps) {
  const className = `octo-cmdk__item${active ? ' octo-cmdk__item octo-cmdk__item--active' : ''}`;

  const inner = (
    <>
      <span className="octo-cmdk__item-icon">{icon}</span>
      <div className="octo-cmdk__item-body">
        <div className={`octo-cmdk__item-label${mono ? ' octo-cmdk__item-label octo-cmdk__item-label--mono' : ''}`}>
          {title}
        </div>
        {sub && <div className="octo-cmdk__item-meta">{sub}</div>}
      </div>
      {badge && <span className="octo-cmdk__item-badge">{badge}</span>}
      {kbd && (
        <span className="octo-cmdk__item-kbd">
          {kbd.map((k, i) => (
            <Kbd key={i}>{k}</Kbd>
          ))}
        </span>
      )}
    </>
  );

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
