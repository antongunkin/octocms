import React from 'react';

import { CardSkeleton } from '../../skeletons/blocks';
import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Right-hand sidebar placeholder for the entry editor — Entry details +
 * History + LinkedBy cards.
 */
export function EntrySidebarSkeleton() {
  return (
    <div className="octo-edit-post__sidebar" role="status" aria-label="Loading entry sidebar">
      <div>
        <ShimmerBlock className="octo-skel-h-3 octo-skel-w-24 octo-edit-post__skel-mb" />
        <div className="octo-skel-col-10">
          <ShimmerBlock className="octo-skel-h-3 octo-skel-w-full" />
          <ShimmerBlock className="octo-skel-h-3 octo-skel-w-2-3" />
          <ShimmerBlock className="octo-skel-h-3 octo-skel-w-1-2" />
        </div>
      </div>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
    </div>
  );
}
