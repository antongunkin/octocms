import React from 'react';

import { ContentModelListPageSkeleton } from '../../ContentModel/skeletons/ContentModelListPageSkeleton';
import { ContentTypeDetailPageSkeleton } from '../../ContentModel/skeletons/ContentTypeDetailPageSkeleton';
import { DashboardPageSkeleton } from '../../Dashboard/skeletons/DashboardPageSkeleton';
import { DashboardCollectionPageSkeleton } from '../../Dashboard/skeletons/DashboardCollectionPageSkeleton';
import { EditPostPageSkeleton } from '../../EditPost/skeletons/EditPostPageSkeleton';
import { MediaAssetPageSkeleton } from '../../MediaAsset/skeletons/MediaAssetPageSkeleton';
import { MediaManagerPageSkeleton } from '../../MediaManager/skeletons/MediaManagerPageSkeleton';

import { NeutralPageSkeleton } from './NeutralPageSkeleton';

export {
  ContentModelListPageSkeleton,
  ContentTypeDetailPageSkeleton,
  DashboardCollectionPageSkeleton,
  DashboardPageSkeleton,
  EditPostPageSkeleton,
  MediaAssetPageSkeleton,
  MediaManagerPageSkeleton,
  NeutralPageSkeleton,
};

/**
 * Pick the full-page skeleton that matches the destination admin route.
 * Used by `RouteMainSlotSkeleton` and dynamic-import `loading` fallbacks.
 */
export function resolveAdminRouteSkeleton(pathname: string): React.ReactNode {
  const path = pathname.split('?')[0] ?? '/cms';

  if (/^\/cms\/content\/[^/]+\/[^/]+$/.test(path)) {
    return <EditPostPageSkeleton />;
  }
  if (/^\/cms\/content\/[^/]+$/.test(path)) {
    return <DashboardCollectionPageSkeleton />;
  }
  if (/^\/cms\/media\/[^/]+$/.test(path)) {
    return <MediaAssetPageSkeleton />;
  }
  if (path === '/cms/media' || path.startsWith('/cms/media/')) {
    return <MediaManagerPageSkeleton />;
  }
  if (/^\/cms\/model\/[^/]+$/.test(path)) {
    return <ContentTypeDetailPageSkeleton />;
  }
  if (path === '/cms/model' || path.startsWith('/cms/model/')) {
    return <ContentModelListPageSkeleton />;
  }
  if (path === '/cms' || path === '/cms/content' || path.startsWith('/cms/content')) {
    return <DashboardPageSkeleton />;
  }

  return <NeutralPageSkeleton />;
}
