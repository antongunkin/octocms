import React from 'react';

import { TopHeaderSkeleton } from '../Layout/skeletons/TopHeaderSkeleton';

import { NeutralPageSkeleton } from '../Layout/skeletons/NeutralPageSkeleton';

/**
 * Full-viewport shell while `AdminLayoutInner` runs (e.g. `getThemeCookie()`).
 * No providers are mounted yet — static shimmer only.
 */
export function AdminBootstrapSkeleton() {
  return (
    <div className="octo-layout" role="status" aria-label="Loading CMS">
      <TopHeaderSkeleton />
      <div className="octo-page-shell octo-page-shell--skel-overflow">
        <NeutralPageSkeleton />
      </div>
    </div>
  );
}
