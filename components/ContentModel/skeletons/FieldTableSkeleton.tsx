import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../../skeletons/primitives';

/**
 * Mirrors the field table inside `ContentTypeDetail` — drag handle, key,
 * format badge, label, flags column.
 */
export function FieldTableSkeleton({ rows = 8 }: { rows?: number }) {
  const widths = ['10%', '24%', '14%', '20%', '8%'];
  return (
    <div role="status" aria-label="Loading fields" className="octo-skeleton-table">
      <ShimmerBlock className="mb-3 h-4 w-32" />
      <div className="octo-skeleton-table__rows">
        {Array.from({ length: rows }, (_, i) => (
          <ShimmerRow key={i} widths={widths} />
        ))}
      </div>
    </div>
  );
}
