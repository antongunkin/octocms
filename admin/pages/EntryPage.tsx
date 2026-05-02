import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import React from 'react';

import EditPost from '../../components/EditPost/EditPost';
import { FileContextProvider } from '../../hooks/useFileState';
import { parseFileName } from '../../utils/parseFileName';
import { getContentFiles, getFile } from '../actions';
import { authOptions } from '../auth';

export async function EntryPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;

  if (!type) {
    redirect(`/cms/content`);
  }

  // Media entries have a dedicated full-page editor at /cms/media/[id].
  // Mounting them through `EditPost` would render an empty form because there
  // is no `media` collection in the user's schema. The destination runs its
  // own auth check, so this redirect is safe to do before authenticating.
  if (type === 'media') {
    redirect(`/cms/media/${id}`);
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const files = await getContentFiles();
  const file = files.find((f) => f.includes(id));
  const parsedFileName = file ? parseFileName(file) : undefined;

  if (!parsedFileName) {
    // Unknown id — surface a clear 404 so broken links don't silently bounce
    // the user back to a list page.
    notFound();
  }

  const post = await getFile(parsedFileName.path);

  return (
    <FileContextProvider defaultType={type} defaultFile={parsedFileName}>
      <EditPost post={post} />
    </FileContextProvider>
  );
}
