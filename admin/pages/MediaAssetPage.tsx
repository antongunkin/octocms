import React from 'react';
import { getServerSession } from 'next-auth';

import { ErrorBoundary } from '../../components/ErrorBoundary';
import { MediaAsset } from '../../components/MediaAsset/MediaAsset';
import { authOptions } from '../auth';

/**
 * Auth-gated thin shell. `MediaAsset` fetches the media list via
 * `useMediaAsset(id)` and shares the cache with `/cms/media`. The not-found
 * case is rendered inside the component once the list resolves, instead of
 * triggering a server-side `notFound()` — keeps navigation between assets
 * instant from the warm cache.
 */
export async function MediaAssetPage({ id }: { id: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  return (
    <ErrorBoundary label="media asset">
      <MediaAsset id={id} />
    </ErrorBoundary>
  );
}
