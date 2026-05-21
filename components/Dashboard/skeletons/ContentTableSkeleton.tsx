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
            <ShimmerBlock style={{ height: 36, flex: '0 1 420px', borderRadius: 8 }} />
            <ShimmerBlock style={{ height: 36, width: 130, borderRadius: 9999 }} />
            <ShimmerBlock style={{ height: 36, width: 130, borderRadius: 9999 }} />
            <div className="octo-content-sort">
              <ShimmerBlock style={{ height: 36, width: 138, borderRadius: 9999 }} />
            </div>
          </div>
          <div className="octo-content-card">
            <div
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', padding: '10px 16px' }}
            >
              <ShimmerRow widths={['40%', '14%', '16%', '12%']} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px' }}>
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
