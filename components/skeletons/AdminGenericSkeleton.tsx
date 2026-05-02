import React from 'react';

import { ShimmerBlock } from './primitives';

/**
 * Default route-level fallback. The shared admin layout (`Layout`) provides
 * the real `TopHeader`, so this skeleton occupies only the `<main>` slot —
 * matches what `loading.tsx` actually replaces during navigation.
 */
export function AdminGenericSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-muted/20 p-6" role="status" aria-label="Loading">
      <ShimmerBlock className="h-8 w-1/3" />
      <ShimmerBlock className="h-4 w-2/3" />
      <ShimmerBlock className="h-64 w-full" />
    </div>
  );
}
