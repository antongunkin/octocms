import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

export function DashboardContentSkeleton() {
  return (
    <div className="octo-page-shell" role="status" aria-label="Loading dashboard">
      <div className="octo-page-chrome">
        <ShimmerBlock className="octo-dashboard-skel__heading-skel" />
      </div>
      <div className="octo-dashboard-skel__empty">
        <ShimmerBlock className="octo-dashboard-skel__empty-line" />
      </div>
    </div>
  );
}
