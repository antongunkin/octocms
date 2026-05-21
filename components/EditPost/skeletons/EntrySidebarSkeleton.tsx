import React from 'react';

import { CardSkeleton } from '../../skeletons/blocks';
import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Right-hand sidebar placeholder for the entry editor — Entry details +
 * History + LinkedBy cards.
 */
export function EntrySidebarSkeleton() {
  return (
    <aside role="status" aria-label="Loading entry sidebar" className="octo-edit-post__sidebar">
      <div>
        <ShimmerBlock className="mb-2.5 h-3 w-24" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <ShimmerBlock className="h-3 w-full" />
          <ShimmerBlock className="h-3 w-2/3" />
          <ShimmerBlock className="h-3 w-1/2" />
        </div>
      </div>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
    </aside>
  );
}
