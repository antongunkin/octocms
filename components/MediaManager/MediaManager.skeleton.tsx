import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/** Mirrors `MediaManager` — left panel + dropzone + tile grid. */
export function MediaManagerSkeleton() {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-label="Loading media">
      <div className="flex min-h-[52px] items-center justify-between border-b border-border bg-[var(--bg)] px-6 py-3">
        <ShimmerBlock className="h-5 w-32" />
        <ShimmerBlock className="h-8 w-28 rounded-md" />
      </div>
      <div className="flex flex-1">
        <aside className="w-[248px] shrink-0 border-r border-border bg-[var(--surface-2)] p-3">
          <ShimmerBlock className="mb-3 h-7 w-full rounded-lg" />
          <ShimmerBlock className="mb-2 ml-2 h-3 w-16" />
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <ShimmerBlock key={i} className="h-7 w-full rounded-lg" />
            ))}
          </div>
        </aside>
        <div className="flex flex-1 flex-col bg-[var(--bg)]">
          <div className="px-6 pt-4">
            <ShimmerBlock className="h-16 w-full rounded-xl" />
          </div>
          <div className="px-6 pb-3 pt-3">
            <ShimmerBlock className="h-8 w-72 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4 px-6 pb-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <ShimmerBlock className="aspect-square w-full rounded-xl" />
                <ShimmerBlock className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
