import React from 'react';
import { getServerSession } from 'next-auth';

import MediaManager from '../../components/MediaManager/MediaManager';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { authOptions } from '../auth';

/**
 * Auth-gated thin shell. `MediaManager` fetches its own data via TanStack
 * Query (`useMediaList`) and renders block-level skeletons for the left panel
 * and grid/list slots. See `octocms/admin/query/hooks/useMediaList.ts`.
 */
export async function MediaPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  return (
    <ErrorBoundary label="media library">
      <MediaManager />
    </ErrorBoundary>
  );
}
