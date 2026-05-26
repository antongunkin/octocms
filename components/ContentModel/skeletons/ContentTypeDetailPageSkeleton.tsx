import React from 'react';

import { PageChromeSkeleton } from '../../Layout/skeletons/PageChromeSkeleton';

import { FieldTableSkeleton } from './FieldTableSkeleton';

/** Full-page fallback for `/cms/model/<type>`. */
export function ContentTypeDetailPageSkeleton() {
  return (
    <PageChromeSkeleton actionCount={2} ariaLabel="Loading content type">
      <FieldTableSkeleton />
    </PageChromeSkeleton>
  );
}
