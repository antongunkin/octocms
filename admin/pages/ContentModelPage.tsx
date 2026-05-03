import React from 'react';
import { getServerSession } from 'next-auth';

import ContentModelList from '../../components/ContentModel/ContentModelList';
import { authOptions } from '../auth';

/**
 * Auth-gated thin shell. `ContentModelList` fetches its own data via
 * `useSchema` + `useEntryList` and renders block-level skeletons while
 * pending. See `octocms/admin/query/hooks/useSchema.ts`.
 */
export async function ContentModelPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  return <ContentModelList />;
}
