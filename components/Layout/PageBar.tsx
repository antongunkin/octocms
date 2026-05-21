// PageBar — secondary bar under TopHeader for page-level title + breadcrumb +
// status badge + actions slot. Sticky directly below the TopHeader so it
// never scrolls away. Used by pages that adopt PageShell.
'use client';

import * as React from 'react';
import type { EntryStatus } from '../../types';
import { StatusBadge } from '../ui';

export type PageBarProps = {
  title?: React.ReactNode;
  breadcrumb?: React.ReactNode[];
  status?: EntryStatus;
  right?: React.ReactNode;
};

export function PageBar({ title, breadcrumb, status, right }: PageBarProps) {
  if (!title && !breadcrumb && !right) return null;
  return (
    <div className="octo-page-bar">
      <div className="octo-page-bar__title-area">
        {breadcrumb && (
          <div className="octo-page-bar__breadcrumb">
            {breadcrumb.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRightTiny />}
                <span style={{ color: i === breadcrumb.length - 1 ? 'var(--text-2)' : 'var(--muted)' }}>{b}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="octo-page-bar__title-row">
          <h1 className="octo-page-bar__title">{title}</h1>
          {status && <StatusBadge status={status} size="sm" />}
        </div>
      </div>
      {right && <div className="octo-page-bar__right">{right}</div>}
    </div>
  );
}

function ChevronRightTiny() {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-50"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
