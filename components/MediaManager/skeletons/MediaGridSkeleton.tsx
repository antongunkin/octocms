import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Tile grid placeholder. Tile count defaults to 12 — enough to fill the
 * fold without making the page feel empty during a fast resolve.
 */
export function MediaGridSkeleton({ tiles = 12 }: { tiles?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading media grid"
      className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4"
    >
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <ShimmerBlock className="aspect-square w-full rounded-xl" />
          <ShimmerBlock className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
