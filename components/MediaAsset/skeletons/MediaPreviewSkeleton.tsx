import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/** Mirrors the centered preview pane in `MediaAsset` (large rounded box). */
export function MediaPreviewSkeleton() {
  return (
    <div role="status" aria-label="Loading preview" className="octo-media-asset__preview">
      <ShimmerBlock className="octo-skel-h-80 octo-skel-w-80 octo-skel-rounded-lg" />
    </div>
  );
}
