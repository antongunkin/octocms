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
