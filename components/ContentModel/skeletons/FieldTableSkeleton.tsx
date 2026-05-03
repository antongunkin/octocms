import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../../skeletons/primitives';

/**
 * Mirrors the field table inside `ContentTypeDetail` — drag handle, key,
 * format badge, label, flags column.
 */
export function FieldTableSkeleton({ rows = 8 }: { rows?: number }) {
  const widths = ['10%', '24%', '14%', '20%', '8%'];
  return (
    <div role="status" aria-label="Loading fields" className="rounded-lg border border-border bg-background p-4">
      <ShimmerBlock className="mb-3 h-4 w-32" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <ShimmerRow key={i} widths={widths} />
        ))}
      </div>
    </div>
  );
}
