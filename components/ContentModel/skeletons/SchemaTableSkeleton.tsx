import React from 'react';

import { ShimmerRow } from '../../skeletons/primitives';

/**
 * Mirrors the table inside `ContentModelList` — Name, Key, Cardinality,
 * Fields, Entries columns.
 */
export function SchemaTableSkeleton({ rows = 6 }: { rows?: number }) {
  const widths = ['28%', '20%', '12%', '12%', '14%'];
  return (
    <div
      role="status"
      aria-label="Loading content types"
      className="overflow-hidden rounded-lg border border-border bg-background"
    >
      <div className="border-b border-border bg-[var(--surface-2)] px-4 py-2.5">
        <ShimmerRow widths={widths} />
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        {Array.from({ length: rows }, (_, i) => (
          <ShimmerRow key={i} widths={widths} />
        ))}
      </div>
    </div>
  );
}
