import React from 'react';

import { DashboardListSkeleton } from './DashboardContent.list.skeleton';

/** Single-collection variant of the content listing. Same shape, fewer rows. */
export function DashboardCollectionSkeleton() {
  return <DashboardListSkeleton rows={6} />;
}
