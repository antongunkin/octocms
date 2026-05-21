import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Tile grid placeholder. Tile count defaults to 12 — enough to fill the
 * fold without making the page feel empty during a fast resolve.
 */
export function MediaGridSkeleton({ tiles = 12 }: { tiles?: number }) {
  return (
    <div role="status" aria-label="Loading media grid" className="octo-media-grid">
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <ShimmerBlock className="aspect-square w-full rounded-xl" />
          <ShimmerBlock className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
