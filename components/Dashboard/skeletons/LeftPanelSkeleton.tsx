import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Mirrors `LeftPanel` chrome inside `DashboardContent`: same width + colors,
 * with shimmering rows where the nav items will land.
 */
export function LeftPanelSkeleton() {
  return (
    <div role="status" aria-label="Loading collections">
      <div className="octo-page-sidebar__section">
        <nav className="octo-page-sidebar__nav">
          {Array.from({ length: 3 }, (_, i) => (
            <ShimmerBlock key={i} className="octo-skel-h-7 octo-skel-w-full" />
          ))}
        </nav>
      </div>
      <div className="octo-page-sidebar__section">
        <span className="octo-page-sidebar__section-label" aria-hidden="true">
          <ShimmerBlock className="octo-skel-h-3 octo-skel-w-20" />
        </span>
        <nav className="octo-page-sidebar__nav">
          {Array.from({ length: 4 }, (_, i) => (
            <ShimmerBlock key={i} className="octo-skel-h-7 octo-skel-w-full" />
          ))}
        </nav>
      </div>
    </div>
  );
}
