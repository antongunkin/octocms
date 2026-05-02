import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

export function DashboardContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-muted/20" role="status" aria-label="Loading dashboard">
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <ShimmerBlock className="h-6 w-32" />
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <ShimmerBlock className="h-4 w-48" />
      </div>
    </div>
  );
}
