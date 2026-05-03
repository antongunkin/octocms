import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../../skeletons/primitives';

/**
 * Mirrors `ContentTable` chrome: search/filter toolbar, then a card with
 * eight shimmering rows matching the four real columns
 * (Title 40%, Type 14%, Branch 16%, Updated 12%).
 */
export function ContentTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading entries" className="flex flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      <div className="scroll flex-1 overflow-auto px-6 pb-12 pt-5">
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <ShimmerBlock className="h-9 flex-[0_1_420px] rounded-lg" />
            <ShimmerBlock className="h-9 w-[130px] rounded-full" />
            <ShimmerBlock className="h-9 w-[130px] rounded-full" />
            <div className="ml-auto">
              <ShimmerBlock className="h-9 w-[138px] rounded-full" />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-[var(--surface-1)] shadow-[var(--shadow-1)]">
            <div className="border-b border-border bg-[var(--surface-2)] px-4 py-2.5">
              <ShimmerRow widths={['40%', '14%', '16%', '12%']} />
            </div>
            <div className="flex flex-col gap-3 px-4 py-3">
              {Array.from({ length: rows }, (_, i) => (
                <ShimmerRow key={i} widths={['40%', '14%', '16%', '12%']} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
