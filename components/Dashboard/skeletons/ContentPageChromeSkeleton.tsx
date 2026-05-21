import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

import { ContentTableSkeleton } from './ContentTableSkeleton';
import { LeftPanelSkeleton } from './LeftPanelSkeleton';

/**
 * In-page chrome matching `DashboardContent` while entries load: breadcrumb
 * row + primary action + `LeftPanelSkeleton` + `ContentTableSkeleton`. Shared by
 * `MainSlotSkeleton` / `AdminBootstrapSkeleton` so the main-area shimmer
 * matches the admin index (`/cms`) block skeletons.
 */
export function ContentPageChromeSkeleton() {
  return (
    <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      <div className="octo-page-chrome">
        <div className="octo-page-chrome__title-area">
          <div className="octo-page-chrome__breadcrumb">
            <ShimmerBlock style={{ height: 12, width: 64 }} />
          </div>
          <div>
            <ShimmerBlock style={{ height: 24, width: 160, maxWidth: '100%', borderRadius: 4 }} />
          </div>
        </div>
        <div className="octo-page-chrome__right">
          <ShimmerBlock style={{ height: 32, width: 112, flexShrink: 0, borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ display: 'flex', minHeight: 0, flex: 1, overflow: 'hidden' }}>
        <LeftPanelSkeleton />
        <ContentTableSkeleton />
      </div>
    </div>
  );
}
