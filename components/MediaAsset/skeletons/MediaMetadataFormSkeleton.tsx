import React from 'react';

import { FormFieldSkeleton } from '../../skeletons/blocks';
import { ShimmerBlock } from '../../skeletons/primitives';

/** Mirrors the right-hand metadata sidebar in `MediaAsset`. */
export function MediaMetadataFormSkeleton() {
  return (
    <aside role="status" aria-label="Loading metadata" className="octo-media-asset__sidebar">
      <div className="octo-media-asset__sidebar-inner">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <FormFieldSkeleton />
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-full octo-skel-rounded-md" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <FormFieldSkeleton />
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-full octo-skel-rounded-md" />
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
  );
}
