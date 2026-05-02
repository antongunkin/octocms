import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../skeletons/primitives';

/**
 * Mirrors `DashboardContent` — left collection sidebar + main entries table.
 */
export function DashboardListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-1" role="status" aria-label="Loading content">
      <aside className="w-60 border-r border-border bg-background p-4">
        <ShimmerBlock className="mb-4 h-4 w-24" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <ShimmerBlock key={i} className="h-7 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex flex-1 flex-col gap-4 bg-muted/20 p-6">
        <div className="flex items-center justify-between">
          <ShimmerBlock className="h-7 w-40" />
          <ShimmerBlock className="h-8 w-28 rounded-md" />
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex flex-col gap-3">
            {Array.from({ length: rows }, (_, i) => (
              <ShimmerRow key={i} widths={['40%', '12%', '14%', '12%']} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
