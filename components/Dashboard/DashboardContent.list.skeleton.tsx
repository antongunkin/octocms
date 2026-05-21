import React from 'react';

import { ShimmerBlock, ShimmerRow } from '../skeletons/primitives';

/**
 * Mirrors `DashboardContent` — left collection sidebar + main entries table.
 */
export function DashboardListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flex: 1 }} role="status" aria-label="Loading content">
      <aside className="octo-left-panel" style={{ width: 240 }}>
        <div className="octo-left-panel__section">
          <ShimmerBlock style={{ height: 16, width: 96, marginBottom: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <ShimmerBlock key={i} style={{ height: 28, width: '100%' }} />
            ))}
          </div>
        </div>
      </aside>
      <div className="octo-content-area" style={{ padding: 24, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <ShimmerBlock style={{ height: 28, width: 160 }} />
          <ShimmerBlock style={{ height: 32, width: 112, borderRadius: 6 }} />
        </div>
        <div className="octo-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: rows }, (_, i) => (
              <ShimmerRow key={i} widths={['40%', '12%', '14%', '12%']} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
