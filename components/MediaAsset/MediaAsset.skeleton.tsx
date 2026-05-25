import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/** Mirrors `MediaAsset` — header, large preview pane, sidebar form. */
export function MediaAssetSkeleton() {
  return (
    <div className="octo-media-asset" role="status" aria-label="Loading asset">
      <div className="octo-page-top">
        <div className="octo-skel-row-8">
          <ShimmerBlock className="octo-skel-h-7 octo-skel-w-7 octo-skel-rounded-md" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <ShimmerBlock className="octo-skel-h-3 octo-skel-w-24" />
            <ShimmerBlock className="octo-skel-h-4 octo-skel-w-48" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-32 octo-skel-rounded-md" />
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-20 octo-skel-rounded-md" />
        </div>
      </div>
      <div className="octo-media-asset__body">
        <div className="octo-media-asset__preview">
          <ShimmerBlock className="octo-skel-h-80 octo-skel-w-80 octo-skel-rounded-lg" />
        </div>
        <aside className="octo-media-asset__sidebar">
          <div className="octo-media-asset__sidebar-inner">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <ShimmerBlock className="octo-skel-h-3 octo-skel-w-12" />
              <ShimmerBlock className="octo-skel-h-9 octo-skel-w-full octo-skel-rounded-lg" />
              <ShimmerBlock className="octo-skel-h-8 octo-skel-w-full octo-skel-rounded-md" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <ShimmerBlock className="octo-skel-h-3 octo-skel-w-12" />
              <ShimmerBlock className="octo-skel-h-9 octo-skel-w-full octo-skel-rounded-lg" />
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
                  <ShimmerBlock className="octo-skel-h-3 octo-skel-w-20" />
                  <ShimmerBlock className="octo-skel-h-3" style={{ flex: 1 }} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
