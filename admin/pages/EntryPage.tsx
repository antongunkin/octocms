import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import React, { Suspense } from 'react';

import EditPost from '../../components/EditPost/EditPost';
import { FileContextProvider } from '../../hooks/useFileState';
import { parseFileName } from '../../utils/parseFileName';
import { getContentFiles, getFile } from '../actions';
import { authOptions } from '../auth';

export function EntryPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  return (
    <Suspense fallback={null}>
      <EntryPageContent params={params} />
    </Suspense>
  );
}

async function EntryPageContent({ params }: { params: Promise<{ type: string; id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const { type, id } = await params;
  const files = await getContentFiles();
  const file = files.find((file) => file.includes(id));
  const parsedFileName = file ? parseFileName(file) : undefined;
  let post;

  if (!type) {
    redirect(`/`);
  }

  if (!parsedFileName) {
    redirect(`/cms/${type}`);
  }

  if (parsedFileName?.path) {
    post = await getFile(parsedFileName.path);
  }

  return (
    <FileContextProvider defaultType={type} defaultFile={parsedFileName}>
      <EditPost post={post} />
    </FileContextProvider>
  );
}
