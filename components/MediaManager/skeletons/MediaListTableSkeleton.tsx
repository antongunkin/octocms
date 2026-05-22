import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../../skeletons/primitives';

/**
 * Mirrors `MediaListTable` — header row + N body rows. Column widths match
 * the real table (Title 40%, Folder 16%, Format 12%, Dimensions 14%, File 16%).
 */
export function MediaListTableSkeleton({ rows = 8 }: { rows?: number }) {
  const widths = ['40%', '16%', '12%', '14%', '16%'];
  return (
    <div role="status" aria-label="Loading media list" className="octo-content-card">
      <div className="octo-content-card__th-row" style={{ padding: '10px 16px' }}>
        <ShimmerRow widths={widths} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 16px' }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ShimmerBlock className="octo-skel-h-7 octo-skel-w-7 octo-u-shrink-0 octo-skel-rounded-md" />
            <ShimmerRow className="octo-u-flex-1" widths={widths} />
          </div>
        ))}
      </div>
    </div>
  );
}
