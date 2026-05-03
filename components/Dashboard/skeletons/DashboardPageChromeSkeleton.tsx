import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

import { ContentTableSkeleton } from './ContentTableSkeleton';
import { LeftPanelSkeleton } from './LeftPanelSkeleton';

/**
 * In-page chrome matching `DashboardContent` while entries load: breadcrumb
 * row + primary action + `LeftPanelSkeleton` + `ContentTableSkeleton`. Shared by
 * `MainSlotSkeleton` / `AdminBootstrapSkeleton` so the main-area shimmer
 * matches `/cms/content` block skeletons.
 */
export function DashboardPageChromeSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-[var(--bg)] px-6 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-px flex items-center gap-1.5">
            <ShimmerBlock className="h-3 w-16" />
          </div>
          <div>
            <ShimmerBlock className="h-6 w-40 max-w-full rounded-sm" />
          </div>
        </div>
        <div className="flex-none">
          <ShimmerBlock className="h-8 w-28 shrink-0 rounded-md" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftPanelSkeleton />
        <ContentTableSkeleton />
      </div>
    </div>
  );
}
