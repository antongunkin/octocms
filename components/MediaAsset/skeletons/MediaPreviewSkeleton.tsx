import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/** Mirrors the centered preview pane in `MediaAsset` (large rounded box). */
export function MediaPreviewSkeleton() {
  return (
    <div role="status" aria-label="Loading preview" className="octo-media-asset__preview">
      <ShimmerBlock className="h-80 w-80 rounded-lg" />
    </div>
  );
}
