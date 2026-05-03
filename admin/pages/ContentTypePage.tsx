import React from 'react';
import { getServerSession } from 'next-auth';

import ContentTypeDetail from '../../components/ContentModel/ContentTypeDetail';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { authOptions } from '../auth';

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
