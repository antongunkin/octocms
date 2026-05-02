import React from 'react';
import { getServerSession } from 'next-auth';

import ContentTypeDetail from '../../components/ContentModel/ContentTypeDetail';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { getEntryList } from '../actions';
import { getSchema } from '../actions/schema';
import { authOptions } from '../auth';

export async function ContentTypePage({ type }: { type: string }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const [schema, entries] = await Promise.all([getSchema(), getEntryList(type)]);
  const entryCount = entries.filter((e) => e.type === type).length;

  return (
    <ErrorBoundary label="content type editor" resetKeys={[type]}>
      <ContentTypeDetail schema={schema} type={type} entryCount={entryCount} />
    </ErrorBoundary>
  );
}
