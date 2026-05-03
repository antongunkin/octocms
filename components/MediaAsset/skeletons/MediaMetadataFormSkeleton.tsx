import React from 'react';

import { FormFieldSkeleton } from '../../skeletons/blocks';
import { ShimmerBlock } from '../../skeletons/primitives';

/** Mirrors the right-hand metadata sidebar in `MediaAsset`. */
export function MediaMetadataFormSkeleton() {
  return (
    <aside
      role="status"
      aria-label="Loading metadata"
      className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-border bg-background"
    >
      <div className="space-y-6 px-5 py-5">
        <div className="space-y-1.5">
          <FormFieldSkeleton />
          <ShimmerBlock className="h-8 w-full rounded-md" />
        </div>
        <div className="space-y-1.5">
          <FormFieldSkeleton />
          <ShimmerBlock className="h-8 w-full rounded-md" />
        </div>
        <div className="space-y-2.5 border-t border-border pt-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-2">
              <ShimmerBlock className="h-3 w-20" />
              <ShimmerBlock className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
