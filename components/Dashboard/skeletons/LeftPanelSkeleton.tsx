import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Mirrors `LeftPanel` chrome inside `DashboardContent`: same width + colors,
 * with shimmering rows where the nav items will land.
 */
export function LeftPanelSkeleton() {
  return (
    <aside role="status" aria-label="Loading collections" className="octo-left-panel">
      <div className="octo-left-panel__section">
        <nav className="octo-left-panel__nav octo-left-panel__nav--gap-6">
          <ShimmerBlock className="octo-skel-h-7 octo-skel-w-full" />
          <ShimmerBlock className="octo-skel-h-7 octo-skel-w-full" />
        </nav>
      </div>
      <div className="octo-left-panel__section octo-left-panel__section--pt">
        <ShimmerBlock className="octo-skel-h-3 octo-skel-w-20 octo-skel-mb-2 octo-skel-ml-2" />
        <nav className="octo-left-panel__nav octo-left-panel__nav--gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <ShimmerBlock key={i} className="octo-skel-h-7 octo-skel-w-full" />
          ))}
        </nav>
      </div>
    </aside>
  );
}
