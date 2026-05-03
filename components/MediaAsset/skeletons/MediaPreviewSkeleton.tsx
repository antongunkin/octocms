import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/** Mirrors the centered preview pane in `MediaAsset` (large rounded box). */
export function MediaPreviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading preview"
      className="flex flex-1 items-center justify-center overflow-auto bg-[var(--surface-2)] p-8"
    >
      <ShimmerBlock className="h-80 w-80 rounded-lg border border-border bg-background" />
    </div>
  );
}
