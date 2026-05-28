import React from 'react';
import dynamic from 'next/dynamic';

import { MediaManagerPageSkeleton } from '../../components/MediaManager/skeletons/MediaManagerPageSkeleton';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import { getCmsSession } from '../auth/session';

const MediaManager = dynamic(() => import('../../components/MediaManager/MediaManager'), {
  loading: () => <MediaManagerPageSkeleton />,
});

/**
 * Auth-gated thin shell. `MediaManager` fetches its own data via TanStack
 * Query (`useMediaList`) and renders block-level skeletons for the left panel
 * and grid/list slots. See `octocms/admin/query/hooks/useMediaList.ts`.
 */
export async function MediaPage() {
  const session = await getCmsSession();

  if (!session) {
    return null;
  }

  return (
    <ErrorBoundary label="media library">
      <MediaManager />
    </ErrorBoundary>
  );
}
