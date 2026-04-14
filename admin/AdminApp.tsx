import React, { Suspense } from 'react';

import { CollectionPage } from './pages/CollectionPage';
import { DashboardPage } from './pages/DashboardPage';
import { EntryPage } from './pages/EntryPage';
import { MediaPage } from './pages/MediaPage';
import { SearchPage } from './pages/SearchPage';

type AdminAppProps = {
  params: Promise<{ path?: string[] }>;
};

/**
 * Catch-all admin router component. Mount this as the default export of a
 * Next.js optional catch-all route at `src/app/cms/[[...path]]/page.tsx`:
 *
 *   export { AdminApp as default } from 'octocms/admin/AdminApp';
 *
 * Route segments map to admin pages:
 *   /cms            → DashboardPage
 *   /cms/search     → SearchPage
 *   /cms/media      → MediaPage (library)
 *   /cms/media/<id> → MediaPage with that asset selected (detail panel)
 *   /cms/<type>     → CollectionPage
 *   /cms/<type>/<id>→ EntryPage
 */
export function AdminApp({ params }: AdminAppProps) {
  return (
    <Suspense fallback={null}>
      <AdminAppRouter params={params} />
    </Suspense>
  );
}

async function AdminAppRouter({ params }: AdminAppProps) {
  const { path } = await params;
  const segments = path ?? [];

  if (segments.length === 0) {
    return <DashboardPage />;
  }

  if (segments[0] === 'search') {
    return <SearchPage />;
  }

  if (segments[0] === 'media') {
    const initialMediaId = segments.length >= 2 ? segments[1] : undefined;
    return <MediaPage initialMediaId={initialMediaId} />;
  }

  if (segments.length === 1) {
    const [type] = segments;
    return <CollectionPage params={Promise.resolve({ type })} />;
  }

  const [type, id] = segments;
  return <EntryPage params={Promise.resolve({ type, id })} />;
}
