import React from 'react';

import { PageChromeSkeleton } from '../../Layout/skeletons/PageChromeSkeleton';
import { ShimmerBlock } from '../../skeletons/primitives';

import { SchemaTableSkeleton } from './SchemaTableSkeleton';

/** Full-page fallback for `/cms/model`. */
export function ContentModelListPageSkeleton() {
  return (
    <PageChromeSkeleton actionCount={1} ariaLabel="Loading content model">
      <div className="octo-content-model__filters">
        <div className="octo-search-wrap">
          <ShimmerBlock className="octo-skel-h-9 octo-skel-w-full octo-skel-rounded-lg" />
        </div>
      </div>
      <SchemaTableSkeleton />
    </PageChromeSkeleton>
  );
}
