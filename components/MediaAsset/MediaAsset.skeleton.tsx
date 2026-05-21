import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/** Mirrors `MediaAsset` — header, large preview pane, sidebar form. */
export function MediaAssetSkeleton() {
  return (
    <div className="octo-media-asset" role="status" aria-label="Loading asset">
      <div className="octo-page-chrome">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShimmerBlock className="h-7 w-7 rounded-md" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="h-4 w-48" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ShimmerBlock className="h-8 w-32 rounded-md" />
          <ShimmerBlock className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <div className="octo-media-asset__body">
        <div className="octo-media-asset__preview">
          <ShimmerBlock className="h-80 w-80 rounded-lg" />
        </div>
        <aside className="octo-media-asset__sidebar">
          <div className="octo-media-asset__sidebar-inner">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <ShimmerBlock className="h-3 w-12" />
              <ShimmerBlock className="h-9 w-full rounded-lg" />
              <ShimmerBlock className="h-8 w-full rounded-md" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <ShimmerBlock className="h-3 w-12" />
              <ShimmerBlock className="h-9 w-full rounded-lg" />
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                borderTop: '1px solid var(--border)',
                paddingTop: '20px',
              }}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px' }}>
                  <ShimmerBlock className="h-3 w-20" />
                  <ShimmerBlock className="h-3 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
