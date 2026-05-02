import React from 'react';
import { getServerSession } from 'next-auth';

import MediaManager from '../../components/MediaManager/MediaManager';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { getMediaEntries } from '../actions';
import { authOptions } from '../auth';

export async function MediaPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const files = await getMediaEntries();

  return (
    <ErrorBoundary label="media library">
      <MediaManager files={files} />
    </ErrorBoundary>
  );
}
