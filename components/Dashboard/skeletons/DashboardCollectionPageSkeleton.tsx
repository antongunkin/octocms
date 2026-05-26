import React from 'react';

import { DashboardPageSkeleton } from './DashboardPageSkeleton';

/** Single-collection variant — same layout, fewer table rows. */
export function DashboardCollectionPageSkeleton() {
  return <DashboardPageSkeleton rows={6} />;
}
