import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/** Mirrors `MediaAsset` — header, large preview pane, sidebar form. */
export function MediaAssetSkeleton() {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-label="Loading asset">
      <div className="flex min-h-[52px] items-center justify-between border-b border-border bg-[var(--bg)] px-6 py-3">
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-7 w-7 rounded-md" />
          <div className="space-y-1">
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-2">
          <ShimmerBlock className="h-8 w-32 rounded-md" />
          <ShimmerBlock className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex flex-1">
        <div className="flex flex-1 items-center justify-center bg-[var(--surface-2)] p-8">
          <ShimmerBlock className="h-80 w-80 rounded-lg" />
        </div>
        <aside className="w-[360px] shrink-0 border-l border-border bg-background p-5">
          <div className="space-y-6">
            <div className="space-y-1.5">
              <ShimmerBlock className="h-3 w-12" />
              <ShimmerBlock className="h-9 w-full rounded-lg" />
              <ShimmerBlock className="h-8 w-full rounded-md" />
            </div>
            <div className="space-y-1.5">
              <ShimmerBlock className="h-3 w-12" />
              <ShimmerBlock className="h-9 w-full rounded-lg" />
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
      </div>
    </div>
  );
}
