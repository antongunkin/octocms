import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../skeletons/primitives';

/** Mirrors `ContentTypeDetail` — title row + field table. */
export function ContentTypeDetailSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="octo-shimmer-page" role="status" aria-label="Loading content type">
      <div className="octo-shimmer-page__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShimmerBlock className="h-7 w-7 rounded-md" />
          <ShimmerBlock className="h-6 w-44" />
        </div>
        <ShimmerBlock className="h-8 w-28 rounded-md" />
      </div>
      <div className="octo-shimmer-page__body">
        <ShimmerBlock className="mb-3 h-4 w-32" />
        <div className="octo-shimmer-page__table">
          {Array.from({ length: rows }, (_, i) => (
            <ShimmerRow key={i} widths={['10%', '24%', '14%', '20%', '8%']} />
          ))}
        </div>
      </div>
    </div>
  );
}
