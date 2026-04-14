import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import React, { Suspense } from 'react';

import ContentTypes from '../../components/ContentTypes';
import { FileContextProvider } from '../../hooks/useFileState';
import { CMSSidebar } from '../../components/CMSSidebar/CMSSidebar';
import { getEntryList } from '../actions';
import { authOptions } from '../auth';

export function CollectionPage({ params }: { params: Promise<{ type: string }> }) {
  return (
    <Suspense fallback={null}>
      <CollectionPageContent params={params} />
    </Suspense>
  );
}

async function CollectionPageContent({ params }: { params: Promise<{ type: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const { type } = await params;
  const entries = await getEntryList();

  if (!type) {
    redirect(`/`);
  }

  return (
    <>
      <CMSSidebar />
      <FileContextProvider defaultType={type}>
        <ContentTypes entries={entries} />
      </FileContextProvider>
    </>
  );
}
