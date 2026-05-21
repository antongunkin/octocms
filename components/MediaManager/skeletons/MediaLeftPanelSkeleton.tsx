import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Mirrors `MediaLeftPanel` chrome — 248px sidebar, "All files" pill,
 * Folders header, then folder rows.
 */
export function MediaLeftPanelSkeleton() {
  return (
    <aside role="status" aria-label="Loading folders" className="octo-media-left-panel">
      <div style={{ padding: '12px 12px 16px' }}>
        <ShimmerBlock className="mb-3 h-7 w-full rounded-lg" />
        <ShimmerBlock className="mb-2 ml-2 h-3 w-16" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Array.from({ length: 5 }, (_, i) => (
            <ShimmerBlock key={i} className="h-7 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </aside>
  );
}
