import React from 'react';
import dynamic from 'next/dynamic';

import { ContentModelListPageSkeleton } from '../../components/ContentModel/skeletons/ContentModelListPageSkeleton';
import { getCmsSession } from '../auth/session';

const ContentModelList = dynamic(() => import('../../components/ContentModel/ContentModelList'), {
  loading: () => <ContentModelListPageSkeleton />,
});

/**
 * Auth-gated thin shell. `ContentModelList` fetches its own data via
 * `useSchema` + `useEntryList` and renders block-level skeletons while
 * pending. See `octocms/admin/query/hooks/useSchema.ts`.
 */
export async function ContentModelPage() {
  const session = await getCmsSession();

  if (!session) {
    return null;
  }

  return <ContentModelList />;
}
