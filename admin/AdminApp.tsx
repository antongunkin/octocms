import { DashboardContentSkeleton } from '../components/Dashboard/DashboardContent.skeleton';

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
 * **No `Suspense` in the dispatcher** — `await params` runs in this async RSC; Next.js
 * keeps the previous segment visible during navigation. Thin server shells (`*Page`)
 * hand off to client components that load via TanStack Query and render their own
 * block-level skeletons (`LeftPanelSkeleton`, `ContentTableSkeleton`, etc.).
 */
export async function AdminApp({ params }: AdminAppProps) {
  const { path } = await params;
  const segments = path ?? [];

  if (segments.length === 0) {
    return <DashboardPage />;
  }

  if (segments[0] === 'chat') {
    return <ChatPage />;
  }

  if (segments[0] === 'media') {
    if (segments.length === 1) {
      return <MediaPage />;
    }
    const id = segments[1];
    return <MediaAssetPage id={id} key={id} />;
  }

  if (segments[0] === 'model') {
    if (segments.length === 1) {
      return <ContentModelPage />;
    }
    const [, type] = segments;
    return <ContentTypePage type={type} key={type} />;
  }

  if (segments[0] === 'content') {
    if (segments.length === 1) {
      return <ContentPage />;
    }
    if (segments.length === 2) {
      const [, type] = segments;
      return <CollectionPage params={Promise.resolve({ type })} key={type} />;
    }
    const [, type, id] = segments;
    return <EntryPage params={Promise.resolve({ type, id })} key={`${type}/${id}`} />;
  }

  return <DashboardContentSkeleton />;
}
