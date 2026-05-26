'use client';

import { usePathname } from 'next/navigation';
import React from 'react';

import { cn } from '../../../lib/utils';

import { resolveAdminRouteSkeleton } from './routeSkeletons';

/**
 * Fills `<main>` while the catch-all `AdminApp` RSC slot suspends. Picks a
 * route-specific page skeleton from the current pathname so cross-route
 * navigation does not flash the content-dashboard layout on media/model/etc.
 */
export function RouteMainSlotSkeleton({ className }: { className?: string }) {
  const pathname = usePathname() ?? '/cms';

  return (
    <div className={cn('octo-page-shell', 'octo-page-shell--skel-overflow', className)}>
      {resolveAdminRouteSkeleton(pathname)}
    </div>
  );
}
