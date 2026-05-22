import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../../skeletons/primitives';

/**
 * Mirrors `ContentTable` chrome: search/filter toolbar, then a card with
 * eight shimmering rows matching the four real columns
 * (Title 40%, Type 14%, Branch 16%, Updated 12%).
 */
export function ContentTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading entries" className="octo-content-area">
      <div className="octo-content-table-wrap octo-scroll">
        <div className="octo-content-table-inner">
          <div className="octo-content-filters">
            <ShimmerBlock className="octo-content-table__skel-search" />
            <ShimmerBlock className="octo-content-table__skel-filter" />
            <ShimmerBlock className="octo-content-table__skel-filter" />
            <div className="octo-content-sort">
              <ShimmerBlock className="octo-content-table__skel-new" />
            </div>
          </div>
          <div className="octo-content-card">
            <div className="octo-content-table__skel-header">
              <ShimmerRow widths={['40%', '14%', '16%', '12%']} />
            </div>
            <div className="octo-content-table__skel-body">
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
