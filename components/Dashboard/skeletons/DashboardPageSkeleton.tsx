import React from 'react';

import { PageChromeSkeleton } from '../../Layout/skeletons/PageChromeSkeleton';

import { ContentTableSkeleton } from './ContentTableSkeleton';
import { LeftPanelSkeleton } from './LeftPanelSkeleton';

type DashboardPageSkeletonProps = {
  rows?: number;
};

/** Full-page fallback for `/cms`, `/cms/content`, and `/cms/content/<type>`. */
export function DashboardPageSkeleton({ rows = 8 }: DashboardPageSkeletonProps) {
  return (
    <PageChromeSkeleton leftBar={<LeftPanelSkeleton />} actionCount={1} ariaLabel="Loading content">
      <ContentTableSkeleton rows={rows} />
    </PageChromeSkeleton>
  );
}

/** @deprecated Use `DashboardPageSkeleton` — kept as alias for existing imports. */
export function ContentPageChromeSkeleton({ rows = 8 }: DashboardPageSkeletonProps) {
  return <DashboardPageSkeleton rows={rows} />;
}
