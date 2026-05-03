import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Mirrors `BranchChip` chrome (h-8, rounded-full, ~88px wide for "main").
 * Shown while `useBranch` / `useHasActiveBranch` are pending so the header
 * doesn't shift width when the real chip mounts.
 */
export function BranchChipSkeleton() {
  return (
    <ShimmerBlock
      role="status"
      aria-label="Loading branch"
      className="h-8 w-[88px] rounded-full border border-[var(--border)] bg-[var(--surface-1)]"
    />
  );
}
