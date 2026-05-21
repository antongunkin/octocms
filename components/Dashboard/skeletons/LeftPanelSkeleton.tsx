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
        <nav className="octo-left-panel__nav" style={{ gap: 6 }}>
          <ShimmerBlock style={{ height: 28, width: '100%' }} />
          <ShimmerBlock style={{ height: 28, width: '100%' }} />
        </nav>
      </div>
      <div className="octo-left-panel__section" style={{ paddingTop: 4 }}>
        <ShimmerBlock style={{ height: 12, width: 80, marginBottom: 8, marginLeft: 8 }} />
        <nav className="octo-left-panel__nav" style={{ gap: 6 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <ShimmerBlock key={i} style={{ height: 28, width: '100%' }} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
