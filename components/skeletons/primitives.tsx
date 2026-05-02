import React from 'react';

import { cn } from '../../lib/utils';

/**
 * Base shimmer block — Tailwind `animate-pulse` over a muted background.
 * Used inside every skeleton in this folder; no external lib.
 */
export function ShimmerBlock({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" {...rest} className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

/** A row of column-cells, used by list / table skeletons. */
export function ShimmerRow({ widths, className }: { widths: string[]; className?: string }) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      {widths.map((w, i) => (
        <ShimmerBlock key={i} className="h-4" style={{ width: w }} />
      ))}
    </div>
  );
}

/**
 * Mock TopHeader bar — matches real `TopHeader` height (56px) so route
 * loading shimmers don't pop the layout when the real header swaps in.
 */
export function HeaderShimmer() {
  return (
    <div className="flex h-14 items-center gap-4 border-b border-border bg-background px-6">
      <ShimmerBlock className="h-6 w-6 rounded-lg" />
      <div className="flex gap-2">
        <ShimmerBlock className="h-4 w-20" />
        <ShimmerBlock className="h-4 w-20" />
        <ShimmerBlock className="h-4 w-20" />
      </div>
      <div className="ml-auto flex gap-2">
        <ShimmerBlock className="h-7 w-28 rounded-md" />
        <ShimmerBlock className="h-7 w-7 rounded-full" />
      </div>
    </div>
  );
}
