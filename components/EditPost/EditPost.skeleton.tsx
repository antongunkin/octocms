import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/**
 * Mirrors `EditPost` — header row, two-column form + sidebar with cards.
 */
export function EditPostSkeleton() {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-label="Loading entry">
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-7 w-7 rounded-md" />
          <ShimmerBlock className="h-5 w-64" />
          <ShimmerBlock className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex gap-2">
          <ShimmerBlock className="h-8 w-20 rounded-md" />
          <ShimmerBlock className="h-8 w-20 rounded-md" />
          <ShimmerBlock className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="flex flex-1 gap-6 bg-muted/20 p-6">
        <div className="flex flex-1 flex-col gap-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <ShimmerBlock className="h-3.5 w-24" />
              <ShimmerBlock className={i === 4 ? 'h-40 w-full' : 'h-9 w-full'} />
            </div>
          ))}
        </div>
        <aside className="flex w-72 flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-lg border border-border bg-background p-4">
              <ShimmerBlock className="mb-3 h-4 w-24" />
              <ShimmerBlock className="h-3 w-full" />
              <ShimmerBlock className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
