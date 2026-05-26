import React from 'react';

import { ShimmerRow } from '../../skeletons/primitives';

/**
 * Mirrors the table inside `ContentModelList` — Name, Key, Cardinality,
 * Fields, Entries columns.
 */
export function SchemaTableSkeleton({ rows = 6 }: { rows?: number }) {
  const widths = ['28%', '20%', '12%', '12%', '14%'];
  return (
    <div role="status" aria-label="Loading content types" className="octo-skeleton-table octo-skeleton-table--schema">
      <div className="octo-skeleton-table__header">
        <ShimmerRow widths={widths} />
      </div>
      <div className="octo-skeleton-table__rows">
        {Array.from({ length: rows }, (_, i) => (
          <ShimmerRow key={i} widths={widths} />
        ))}
      </div>
    </div>
  );
}
