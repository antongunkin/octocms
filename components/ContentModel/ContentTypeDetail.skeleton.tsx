import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../skeletons/primitives';

/** Mirrors `ContentTypeDetail` — title row + field table. */
export function ContentTypeDetailSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="octo-shimmer-page" role="status" aria-label="Loading content type">
      <div className="octo-shimmer-page__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShimmerBlock className="octo-skel-h-7 octo-skel-w-7 octo-skel-rounded-md" />
          <ShimmerBlock className="octo-skel-h-6 octo-skel-w-44" />
        </div>
        <ShimmerBlock className="octo-skel-h-8 octo-skel-w-28 octo-skel-rounded-md" />
      </div>
      <div className="octo-shimmer-page__body">
        <ShimmerBlock className="octo-skel-mb-3 octo-skel-h-4 octo-skel-w-32" />
        <div className="octo-shimmer-page__table">
          {Array.from({ length: rows }, (_, i) => (
            <ShimmerRow key={i} widths={['10%', '24%', '14%', '20%', '8%']} />
          ))}
        </div>
      </div>
    </div>
  );
}
