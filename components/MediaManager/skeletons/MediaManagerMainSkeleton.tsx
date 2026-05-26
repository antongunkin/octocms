import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

import { MediaGridSkeleton } from './MediaGridSkeleton';

/** Upload bar + search + grid placeholders inside `MediaManager` content column. */
export function MediaManagerMainSkeleton() {
  return (
    <div className="octo-media-manager__body">
      <div className="octo-media-manager__content">
        <div className="octo-media-manager__skel-header">
          <ShimmerBlock className="octo-skel-h-16 octo-skel-w-full octo-skel-rounded-xl" />
        </div>
        <div className="octo-media-manager__skel-mid">
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-72 octo-skel-rounded-lg" />
        </div>
        <MediaGridSkeleton />
      </div>
    </div>
  );
}
