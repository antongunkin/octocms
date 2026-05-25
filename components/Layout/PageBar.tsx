'use client';

import Link from 'next/link';
import * as React from 'react';
import type { EntryStatus } from '../../types';
import { StatusBadge } from '../ui';

type PageBarProps = {
  title: string;
  breadcrumbs: { label: string; href?: string }[];
  status?: EntryStatus;
  actions?: React.ReactNode;
};

export function PageBar({ title, breadcrumbs, status, actions }: PageBarProps) {
  if (!title && !breadcrumbs && !actions) {
    return null;
  }

  return (
    <div className="octo-page-top">
      <div className="octo-page-top__title-area">
        {breadcrumbs && (
          <div className="octo-page-top__breadcrumb">
            {breadcrumbs.map(({ label, href }, i) => (
              <React.Fragment key={label}>
                {i > 0 && <ChevronRightTiny />}
                {href ? <Link href={href}>{label}</Link> : label}
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="octo-page-top__title-row">
          <h1 className="octo-page-top__title">{title}</h1>
          {status && <StatusBadge status={status} />}
        </div>
      </div>
      {actions && <div className="octo-page-top__right">{actions}</div>}
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
      className="octo-u-opacity-50"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
