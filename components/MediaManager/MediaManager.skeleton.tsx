import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/** Mirrors `MediaManager` — left panel + dropzone + tile grid. */
export function MediaManagerSkeleton() {
  return (
    <div className="octo-media-manager" role="status" aria-label="Loading media">
      <div className="octo-page-chrome">
        <ShimmerBlock className="octo-skel-h-5 octo-skel-w-32" />
        <ShimmerBlock className="octo-skel-h-8 octo-skel-w-28 octo-skel-rounded-md" />
      </div>
      <div className="octo-media-manager__body">
        <aside className="octo-media-left-panel octo-media-left-panel--skel">
          <ShimmerBlock className="octo-skel-mb-3 octo-skel-h-7 octo-skel-w-full octo-skel-rounded-lg" />
          <ShimmerBlock className="octo-skel-mb-2 octo-skel-ml-2 octo-skel-h-3 octo-skel-w-16" />
          <div className="octo-skel-col-6">
            {Array.from({ length: 5 }, (_, i) => (
              <ShimmerBlock key={i} className="octo-skel-h-7 octo-skel-w-full octo-skel-rounded-lg" />
            ))}
          </div>
        </aside>
        <div className="octo-media-manager__content octo-media-manager__skel-content">
          <div className="octo-media-manager__skel-header">
            <ShimmerBlock className="octo-skel-h-16 octo-skel-w-full octo-skel-rounded-xl" />
          </div>
          <div className="octo-media-manager__skel-mid">
            <ShimmerBlock className="octo-skel-h-8 octo-skel-w-72 octo-skel-rounded-lg" />
          </div>
          <div className="octo-media-grid" style={{ padding: '0 24px 24px' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="octo-media-grid__item-skel">
                <ShimmerBlock className="octo-skel-aspect-square octo-skel-w-full octo-skel-rounded-xl" />
                <ShimmerBlock className="octo-skel-h-3 octo-skel-w-2-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
