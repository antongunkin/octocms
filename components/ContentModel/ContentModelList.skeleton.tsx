import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../skeletons/primitives';

/** Mirrors `ContentModelList` — header + table of content types. */
export function ContentModelListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="octo-shimmer-page" role="status" aria-label="Loading content model">
      <div className="octo-shimmer-page__header">
        <ShimmerBlock className="h-6 w-40" />
        <ShimmerBlock className="h-8 w-36 rounded-md" />
      </div>
      <div className="octo-shimmer-page__body">
        <div className="octo-shimmer-page__table">
          {Array.from({ length: rows }, (_, i) => (
            <ShimmerRow key={i} widths={['28%', '20%', '12%', '12%', '14%']} />
          ))}
        </div>
      </div>
    </div>
  );
}
