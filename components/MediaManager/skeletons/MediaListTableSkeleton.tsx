import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../../skeletons/primitives';

/**
 * Mirrors `MediaListTable` — header row + N body rows. Column widths match
 * the real table (Title 40%, Folder 16%, Format 12%, Dimensions 14%, File 16%).
 */
export function MediaListTableSkeleton({ rows = 8 }: { rows?: number }) {
  const widths = ['40%', '16%', '12%', '14%', '16%'];
  return (
    <div
      role="status"
      aria-label="Loading media list"
      className="overflow-hidden rounded-xl border border-border bg-[var(--surface-1)]"
    >
      <div className="border-b border-border bg-[var(--surface-2)] px-4 py-2.5">
        <ShimmerRow widths={widths} />
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <ShimmerBlock className="h-7 w-7 shrink-0 rounded-md" />
            <ShimmerRow className="flex-1" widths={widths} />
          </div>
        ))}
      </div>
    </div>
  );
}
