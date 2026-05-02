import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../skeletons/primitives';

/** Mirrors `ContentModelList` — header + table of content types. */
export function ContentModelListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-1 flex-col bg-muted/20" role="status" aria-label="Loading content model">
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <ShimmerBlock className="h-6 w-40" />
        <ShimmerBlock className="h-8 w-36 rounded-md" />
      </div>
      <div className="m-6 rounded-lg border border-border bg-background p-4">
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <ShimmerRow key={i} widths={['28%', '20%', '12%', '12%', '14%']} />
          ))}
        </div>
      </div>
    </div>
  );
}
