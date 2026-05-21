import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/** Mirrors `MediaManager` — left panel + dropzone + tile grid. */
export function MediaManagerSkeleton() {
  return (
    <div className="octo-media-manager" role="status" aria-label="Loading media">
      <div className="octo-page-chrome">
        <ShimmerBlock className="h-5 w-32" />
        <ShimmerBlock className="h-8 w-28 rounded-md" />
      </div>
      <div className="octo-media-manager__body">
        <aside className="octo-media-left-panel" style={{ padding: '12px' }}>
          <ShimmerBlock className="mb-3 h-7 w-full rounded-lg" />
          <ShimmerBlock className="mb-2 ml-2 h-3 w-16" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <ShimmerBlock key={i} className="h-7 w-full rounded-lg" />
            ))}
          </div>
        </aside>
        <div className="octo-media-manager__content" style={{ background: 'var(--bg)' }}>
          <div style={{ padding: '16px 24px 0' }}>
            <ShimmerBlock className="h-16 w-full rounded-xl" />
          </div>
          <div style={{ padding: '12px 24px' }}>
            <ShimmerBlock className="h-8 w-72 rounded-lg" />
          </div>
          <div className="octo-media-grid" style={{ padding: '0 24px 24px' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
