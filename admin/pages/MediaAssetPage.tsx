import React from 'react';
import dynamic from 'next/dynamic';
import { getServerSession } from 'next-auth';

import { MediaAssetSkeleton } from '../../components/MediaAsset/MediaAsset.skeleton';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { authOptions } from '../auth';

const MediaAsset = dynamic(() => import('../../components/MediaAsset/MediaAsset'), {
  loading: () => <MediaAssetSkeleton />,
});

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
