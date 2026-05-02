import React from 'react';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { ErrorBoundary } from '../../components/ErrorBoundary';
import { MediaAsset } from '../../components/MediaAsset/MediaAsset';
import { findMediaFileByRequestedId } from '../../components/MediaAsset/findMediaFileByRequestedId';
import { getMediaEntries } from '../actions';
import { authOptions } from '../auth';

export async function MediaAssetPage({ id }: { id: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const files = await getMediaEntries();
  const file = findMediaFileByRequestedId(id, files);
  if (!file) notFound();

  return (
    <ErrorBoundary label="media asset">
      <MediaAsset file={file} allFiles={files} />
    </ErrorBoundary>
  );
}
