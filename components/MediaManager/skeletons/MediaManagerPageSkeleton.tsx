import React from 'react';

import { PageChromeSkeleton } from '../../Layout/skeletons/PageChromeSkeleton';

import { MediaLeftPanelSkeleton } from './MediaLeftPanelSkeleton';
import { MediaManagerMainSkeleton } from './MediaManagerMainSkeleton';

/** Full-page fallback for `/cms/media`. */
export function MediaManagerPageSkeleton() {
  return (
    <PageChromeSkeleton
      className="octo-media-manager"
      leftBar={<MediaLeftPanelSkeleton />}
      actionCount={2}
      ariaLabel="Loading media"
    >
      <MediaManagerMainSkeleton />
    </PageChromeSkeleton>
  );
}
