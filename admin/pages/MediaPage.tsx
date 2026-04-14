import React, { Suspense } from 'react';
import { getServerSession } from 'next-auth';

import MediaManager from '../../components/MediaManager/MediaManager';
import { getMediaEntries } from '../actions';
import { authOptions } from '../auth';

export function MediaPage({ initialMediaId }: { initialMediaId?: string }) {
  return (
    <Suspense fallback={null}>
      <MediaPageContent initialMediaId={initialMediaId} />
    </Suspense>
  );
}

async function MediaPageContent({ initialMediaId }: { initialMediaId?: string }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const files = await getMediaEntries();

  return <MediaManager files={files} initialMediaId={initialMediaId} />;
}
