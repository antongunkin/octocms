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
    <div className="octo-page-chrome octo-page-chrome--skel">
      <div className="octo-page-chrome">
        <div className="octo-page-chrome__title-area">
          <div className="octo-page-chrome__breadcrumb">
            <ShimmerBlock className="octo-skel-h-3 octo-skel-w-16" />
          </div>
          <div>
            <ShimmerBlock className="octo-skel-h-6 octo-skel-w-40" style={{ maxWidth: '100%', borderRadius: 4 }} />
          </div>
        </div>
        <div className="octo-page-chrome__right">
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-28 octo-skel-rounded-md octo-u-shrink-0" />
        </div>
      </div>
      <div className="octo-u-flex octo-u-min-h-0 octo-u-flex-1 octo-u-overflow-hidden">
        <LeftPanelSkeleton />
        <ContentTableSkeleton />
      </div>
    </div>
  );
}
