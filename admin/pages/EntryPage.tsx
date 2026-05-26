import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getServerSession } from 'next-auth';
import React from 'react';

import { EditPostPageSkeleton } from '../../components/EditPost/skeletons/EditPostPageSkeleton';
import { FileContextProvider } from '../../hooks/useFileState';
import { getConfig } from '../../lib/configStore';
import { authOptions } from '../auth';

const EditPost = dynamic(() => import('../../components/EditPost/EditPost'), {
  loading: () => <EditPostPageSkeleton />,
});

/**
 * Auth-gated thin shell. `EditPost` resolves the entry's file path from
 * `type + id`, fetches it via `useEntry`, and renders block-level skeletons
 * (form + sidebar) while pending. Not-found is handled in-component so
 * navigation between entries stays inside the cached SPA.
 *
 * `FileContextProvider` is preserved as a UI-state bus (selectedFile bag)
 * — it no longer carries pre-fetched data.
 */
export async function EntryPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;

  if (!type) {
    redirect(`/cms/content`);
  }

  // Media entries have a dedicated full-page editor at /cms/media/[id].
  if (type === 'media') {
    redirect(`/cms/media/${id}`);
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  // Validate type is a known collection — surfaces invalid URLs as a redirect
  // rather than confusing client-side empty state.
  const collections = Object.keys(getConfig().collections);
  if (!collections.includes(type)) {
    redirect('/cms/content');
  }

  return (
    <FileContextProvider defaultType={type}>
      <EditPost type={type} id={id} />
    </FileContextProvider>
  );
}
