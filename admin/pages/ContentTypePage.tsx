import React, { Suspense } from 'react';
import { getServerSession } from 'next-auth';

import ContentTypeDetail from '../../components/ContentModel/ContentTypeDetail';
import { getEntryList } from '../actions';
import { getSchema } from '../actions/schema';
import { authOptions } from '../auth';

export function ContentTypePage({ type }: { type: string }) {
  return (
    <Suspense fallback={null}>
      <ContentTypePageContent type={type} />
    </Suspense>
  );
}

async function ContentTypePageContent({ type }: { type: string }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const [schema, entries] = await Promise.all([getSchema(), getEntryList(type)]);
  const entryCount = entries.filter((e) => e.type === type).length;

  return <ContentTypeDetail schema={schema} type={type} entryCount={entryCount} />;
}
