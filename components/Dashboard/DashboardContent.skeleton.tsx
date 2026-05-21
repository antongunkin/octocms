import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

export function DashboardContentSkeleton() {
  return (
    <div className="octo-page-shell" role="status" aria-label="Loading dashboard">
      <div className="octo-page-chrome">
        <ShimmerBlock style={{ height: 24, width: 128 }} />
      </div>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ShimmerBlock style={{ height: 16, width: 192 }} />
      </div>
    </div>
  );
}
