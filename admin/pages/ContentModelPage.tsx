import React, { Suspense } from 'react';
import { getServerSession } from 'next-auth';

import ContentModelList from '../../components/ContentModel/ContentModelList';
import { getEntryList } from '../actions';
import { getSchema } from '../actions/schema';
import { authOptions } from '../auth';

export function ContentModelPage() {
  return (
    <Suspense fallback={null}>
      <ContentModelPageContent />
    </Suspense>
  );
}

async function ContentModelPageContent() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const [schema, entries] = await Promise.all([getSchema(), getEntryList()]);

  return <ContentModelList schema={schema} entries={entries} />;
}
