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
    <div className="sticky top-14 z-40 flex min-h-[52px] flex-none items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-6 py-3">
      <div className="min-w-0 flex-1">
        {breadcrumb && (
          <div className="mb-px flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
            {breadcrumb.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRightTiny />}
                <span style={{ color: i === breadcrumb.length - 1 ? 'var(--text-2)' : 'var(--muted)' }}>{b}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold tracking-[-0.012em]">
            {title}
          </h1>
          {status && <StatusBadge status={status} size="sm" />}
        </div>
      </div>
      {right && <div className="flex flex-none items-center gap-2">{right}</div>}
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
