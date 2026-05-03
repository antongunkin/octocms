import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Mirrors `LeftPanel` chrome inside `DashboardContent`: same width + colors,
 * with shimmering rows where the nav items will land.
 */
export function LeftPanelSkeleton() {
  return (
    <aside
      role="status"
      aria-label="Loading collections"
      className="flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border bg-[var(--surface-2)]"
    >
      <nav className="space-y-1.5 px-3 py-4">
        <ShimmerBlock className="h-7 w-full" />
        <ShimmerBlock className="h-7 w-full" />
      </nav>
      <div className="px-3 pb-4 pt-1">
        <ShimmerBlock className="mb-2 ml-2 h-3 w-20" />
        <nav className="space-y-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <ShimmerBlock key={i} className="h-7 w-full" />
          ))}
        </nav>
      </div>
    </aside>
  );
}
