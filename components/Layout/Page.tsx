'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import Link from 'next/link';

type PageProps = {
  title: string;
  breadcrumbs: { label: string; href?: string }[];
  actions?: React.ReactNode;
  className?: string;
  leftBar?: React.ReactNode;
  children: React.ReactNode;
};

export function Page({ title, breadcrumbs, actions, className, leftBar, children }: PageProps) {
  return (
    <div className={cn('octo-page-shell', className)}>
      <div className="octo-page-chrome">
        <div className="octo-page-chrome__title-area">
          {breadcrumbs && (
            <div className="octo-page-chrome__breadcrumb">
              {breadcrumbs.map(({ label, href }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <ChevronRightTiny />}
                  {href ? (
                    <Link href={href} className="octo-page-chrome__breadcrumb">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="octo-page-chrome__title-row">
            <h1 className="octo-page-chrome__title">{title}</h1>
          </div>
        </div>
        {actions && <div className="octo-page-chrome__right">{actions}</div>}
      </div>
      <div className="octo-page-row">
        {leftBar && (
          <aside className="octo-page-sidebar">
            <div className="octo-page-sidebar__bar">{leftBar}</div>
          </aside>
        )}
        <div className="octo-page-content">{children}</div>
      </div>
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
