import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

import { PageChromeSkeleton } from './PageChromeSkeleton';

/** Minimal full-page shimmer for unknown admin routes and bootstrap fallback. */
export function NeutralPageSkeleton() {
  return (
    <PageChromeSkeleton actionCount={0} ariaLabel="Loading">
      <ShimmerBlock className="octo-skel-h-40 octo-skel-w-full octo-skel-rounded-lg" />
    </PageChromeSkeleton>
  );
}
