import React from 'react';

import { cn } from '../../../lib/utils';
import { ShimmerBlock } from '../../skeletons/primitives';

type PageChromeSkeletonProps = {
  className?: string;
  leftBar?: React.ReactNode;
  rightBar?: React.ReactNode;
  children: React.ReactNode;
  /** Number of action-button shimmers in the page header (default 1). */
  actionCount?: number;
  /** Accessible name for the loading region (default "Loading page"). */
  ariaLabel?: string;
};

/**
 * Shimmer shell mirroring `Page` — breadcrumb row, title, actions, optional
 * sidebars, and main content slot. Used for full-page fallbacks (bootstrap,
 * main-slot Suspense, dynamic chunk load).
 */
export function PageChromeSkeleton({
  className,
  leftBar,
  rightBar,
  children,
  actionCount = 1,
  ariaLabel = 'Loading page',
}: PageChromeSkeletonProps) {
  return (
    <div className={cn('octo-page-shell', className)} role="status" aria-label={ariaLabel}>
      <div className="octo-page-top">
        <div className="octo-page-top__title-area">
          <div className="octo-page-top__breadcrumb">
            <ShimmerBlock className="octo-skel-h-3 octo-skel-w-16" />
          </div>
          <div className="octo-page-top__title-row">
            <ShimmerBlock className="octo-page-top__skel-title" />
          </div>
        </div>
        {actionCount > 0 && (
          <div className="octo-page-top__right">
            <div className="octo-page-top__skel-actions">
              {Array.from({ length: actionCount }, (_, i) => (
                <ShimmerBlock key={i} className="octo-skel-h-8 octo-skel-w-20 octo-skel-rounded-md octo-u-shrink-0" />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="octo-page-row">
        {leftBar ? (
          <aside className="octo-page-sidebar octo-page-sidebar--left">
            <div className="octo-page-sidebar__bar">{leftBar}</div>
          </aside>
        ) : null}
        <div className="octo-page-content">{children}</div>
        {rightBar ? (
          <aside className="octo-page-sidebar octo-page-sidebar--right">
            <div className="octo-page-sidebar__bar">{rightBar}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
