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
        <ShimmerBlock className="octo-skel-mb-3 octo-skel-h-7 octo-skel-w-full octo-skel-rounded-lg" />
        <ShimmerBlock className="octo-skel-mb-2 octo-skel-ml-2 octo-skel-h-3 octo-skel-w-16" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Array.from({ length: 5 }, (_, i) => (
            <ShimmerBlock key={i} className="octo-skel-h-7 octo-skel-w-full octo-skel-rounded-lg" />
          ))}
        </div>
      </div>
    </aside>
  );
}
