import React from 'react';

import { ContentPageChromeSkeleton } from '../Dashboard/skeletons/ContentPageChromeSkeleton';
import { TopHeaderSkeleton } from '../Layout/skeletons/TopHeaderSkeleton';

import { cn } from '../../lib/utils';

/**
 * Fills `<main>` while the catch-all `AdminApp` RSC slot suspends (`await params`,
 * etc.). `TopHeader` stays mounted above this boundary.
 */
export function MainSlotSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('octo-page-shell', 'octo-content-area', className)}
      style={{ overflow: 'hidden' }}
      role="status"
      aria-label="Loading page"
    >
      <ContentPageChromeSkeleton />
    </div>
  );
}

/**
 * Full-viewport shell while `AdminLayoutInner` runs (e.g. `getThemeCookie()`).
 * No providers are mounted yet — static shimmer only.
 */
export function AdminBootstrapSkeleton() {
  return (
    <div className="octo-layout" role="status" aria-label="Loading CMS">
      <TopHeaderSkeleton />
      <div className="octo-page-shell" style={{ overflow: 'hidden' }}>
        <ContentPageChromeSkeleton />
      </div>
    </div>
  );
}
