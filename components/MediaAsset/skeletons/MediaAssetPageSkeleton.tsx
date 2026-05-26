import React from 'react';

import { PageChromeSkeleton } from '../../Layout/skeletons/PageChromeSkeleton';

import { MediaMetadataFormSkeleton } from './MediaMetadataFormSkeleton';
import { MediaPreviewSkeleton } from './MediaPreviewSkeleton';

/** Full-page fallback for `/cms/media/<id>`. */
export function MediaAssetPageSkeleton() {
  return (
    <PageChromeSkeleton
      className="octo-media-asset"
      rightBar={<MediaMetadataFormSkeleton />}
      actionCount={1}
      ariaLabel="Loading asset"
    >
      <MediaPreviewSkeleton />
    </PageChromeSkeleton>
  );
}
