import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../skeletons/primitives';

/** Mirrors `ContentTypeDetail` — title row + field table. */
export function ContentTypeDetailSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-1 flex-col bg-muted/20" role="status" aria-label="Loading content type">
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-7 w-7 rounded-md" />
          <ShimmerBlock className="h-6 w-44" />
        </div>
        <ShimmerBlock className="h-8 w-28 rounded-md" />
      </div>
      <div className="m-6 rounded-lg border border-border bg-background p-4">
        <ShimmerBlock className="mb-3 h-4 w-32" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <ShimmerRow key={i} widths={['10%', '24%', '14%', '20%', '8%']} />
          ))}
        </div>
      </div>
    </div>
  );
}
