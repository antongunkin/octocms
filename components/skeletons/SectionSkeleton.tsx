import React from 'react';

import { ShimmerBlock } from './primitives';
import { cn } from '../../lib/utils';

/**
 * Small reusable card-shaped skeleton used as the Suspense fallback for
 * sub-page sections (HistorySection, LinkedBySection, etc.) on the entry
 * editor sidebar. Keep visual weight matched to a real Card component.
 */
export function SectionSkeleton({
  rows = 3,
  title = true,
  className,
}: {
  rows?: number;
  title?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading section"
      className={cn('rounded-lg border border-border bg-background p-4', className)}
    >
      {title ? <ShimmerBlock className="mb-3 h-4 w-24" /> : null}
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <ShimmerBlock key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}
