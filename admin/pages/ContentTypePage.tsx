import React from 'react';
import dynamic from 'next/dynamic';
import { getServerSession } from 'next-auth';

import { ContentTypeDetailSkeleton } from '../../components/ContentModel/ContentTypeDetail.skeleton';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import { authOptions } from '../auth';

const ContentTypeDetail = dynamic(() => import('../../components/ContentModel/ContentTypeDetail'), {
  loading: () => <ContentTypeDetailSkeleton />,
});

/**
 * Auth-gated thin shell. `ContentTypeDetail` fetches schema + entries via
 * `useSchema` + `useEntryList` and renders block skeletons while pending.
 */
export async function ContentTypePage({ type }: { type: string }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  return (
    <ErrorBoundary label="content type editor" resetKeys={[type]}>
      <ContentTypeDetail type={type} />
    </ErrorBoundary>
  );
}
