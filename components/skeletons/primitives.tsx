import React from 'react';

import { cn } from '../../lib/utils';

/**
 * Base shimmer block — BEM octo-shimmer-block animation over a muted background.
 * Used inside every skeleton in this folder; no external lib.
 */
export function ShimmerBlock({ className, style, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  // `animate-pulse` kept as alias so existing test selectors still match.
  return (
    <div aria-hidden="true" {...rest} className={cn('octo-shimmer-block animate-pulse', className)} style={style} />
  );
}

/** A row of column-cells, used by list / table skeletons. */
export function ShimmerRow({ widths, className }: { widths: string[]; className?: string }) {
  return (
    <div className={cn('octo-shimmer-row', className)}>
      {widths.map((w, i) => (
        <ShimmerBlock key={i} style={{ height: 16, width: w }} />
      ))}
    </div>
  );
}
