import React, { Suspense } from 'react';

import { ChatPageSkeleton } from '../components/Chat/ChatPage.skeleton';
import { ContentModelListSkeleton } from '../components/ContentModel/ContentModelList.skeleton';
import { ContentTypeDetailSkeleton } from '../components/ContentModel/ContentTypeDetail.skeleton';
import { DashboardCollectionSkeleton } from '../components/Dashboard/DashboardContent.collection.skeleton';
import { DashboardContentSkeleton } from '../components/Dashboard/DashboardContent.skeleton';
import { DashboardListSkeleton } from '../components/Dashboard/DashboardContent.list.skeleton';
import { EditPostSkeleton } from '../components/EditPost/EditPost.skeleton';
import { MediaAssetSkeleton } from '../components/MediaAsset/MediaAsset.skeleton';
import { MediaManagerSkeleton } from '../components/MediaManager/MediaManager.skeleton';

import { ChatPage } from './pages/ChatPage';
import { CollectionPage } from './pages/CollectionPage';
import { ContentModelPage } from './pages/ContentModelPage';
import { ContentPage } from './pages/ContentPage';
import { ContentTypePage } from './pages/ContentTypePage';
import { DashboardPage } from './pages/DashboardPage';
import { EntryPage } from './pages/EntryPage';
import { MediaAssetPage } from './pages/MediaAssetPage';
import { MediaPage } from './pages/MediaPage';

type AdminAppProps = {
  params: Promise<{ path?: string[] }>;
};

/**
 * Catch-all admin router. Mounted via a single `src/app/cms/[[...path]]/page.tsx`
 * file in the user app that re-exports this component as the default.
 *
 * Route segments map to admin pages:
 *   /cms                     → DashboardPage (empty home)
 *   /cms/content             → ContentPage (all entries)
 *   /cms/content/<type>      → CollectionPage
 *   /cms/content/<type>/<id> → EntryPage
 *   /cms/chat                → ChatPage (gated on `isAgentEnabled(agentConfig)`)
 *   /cms/media               → MediaPage (library — grid + folders)
 *   /cms/media/<id>          → MediaAssetPage (full-page asset editor)
 *   /cms/model               → ContentModelPage
 *   /cms/model/<type>        → ContentTypePage
 *
 * Streaming model: each branch wraps its page in `<Suspense fallback={<MatchingSkeleton/>}>`.
 * There is **no outer Suspense** around AdminApp itself — Next.js's
 * navigation hold-over keeps the previous page rendered until the new one's
 * `await params` resolves, so the user never sees a generic-shimmer flash
 * between sub-routes. Only the inner per-page skeleton is ever visible.
 */
export async function AdminApp({ params }: AdminAppProps) {
  const { path } = await params;
  const segments = path ?? [];

  if (segments.length === 0) {
    return <DashboardPage />;
  }

  if (segments[0] === 'chat') {
    return (
      <Suspense fallback={<ChatPageSkeleton />}>
        <ChatPage />
      </Suspense>
    );
  }

  if (segments[0] === 'media') {
    if (segments.length === 1) {
      return (
        <Suspense fallback={<MediaManagerSkeleton />}>
          <MediaPage />
        </Suspense>
      );
    }
    const id = segments[1];
    return (
      <Suspense fallback={<MediaAssetSkeleton />} key={id}>
        <MediaAssetPage id={id} />
      </Suspense>
    );
  }

  if (segments[0] === 'model') {
    if (segments.length === 1) {
      return (
        <Suspense fallback={<ContentModelListSkeleton />}>
          <ContentModelPage />
        </Suspense>
      );
    }
    const [, type] = segments;
    return (
      <Suspense fallback={<ContentTypeDetailSkeleton />} key={type}>
        <ContentTypePage type={type} />
      </Suspense>
    );
  }

  if (segments[0] === 'content') {
    if (segments.length === 1) {
      return (
        <Suspense fallback={<DashboardListSkeleton />}>
          <ContentPage />
        </Suspense>
      );
    }
    if (segments.length === 2) {
      const [, type] = segments;
      return (
        <Suspense fallback={<DashboardCollectionSkeleton />} key={type}>
          <CollectionPage params={Promise.resolve({ type })} />
        </Suspense>
      );
    }
    const [, type, id] = segments;
    return (
      <Suspense fallback={<EditPostSkeleton />} key={`${type}/${id}`}>
        <EntryPage params={Promise.resolve({ type, id })} />
      </Suspense>
    );
  }

  return <DashboardContentSkeleton />;
}
