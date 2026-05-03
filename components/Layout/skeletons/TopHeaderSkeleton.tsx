import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Static shimmer for the sticky admin bar while layout/providers bootstrap.
 * Mirrors `TopHeader` spacing, height (`h-14`), and surface tokens. Branch
 * chip uses the same footprint as `BranchChipSkeleton` (no nested
 * `role="status"` — the bootstrap root owns the live region).
 */
export function TopHeaderSkeleton() {
  return (
    <header
      className="flex h-14 shrink-0 items-center gap-[10px] border-b border-[var(--border)] bg-[var(--surface-1)] px-6 text-[var(--text)]"
      aria-hidden
    >
      <ShimmerBlock className="h-8 w-[120px] shrink-0 rounded-full border border-[var(--border)] bg-transparent" />
      <span className="mx-1 h-[22px] w-px shrink-0 bg-[var(--border)]" />
      <nav className="flex shrink-0 items-center gap-0.5">
        {Array.from({ length: 4 }, (_, i) => (
          <ShimmerBlock key={i} className="h-8 w-[76px] shrink-0 rounded-full" />
        ))}
      </nav>
      <div className="min-w-0 flex-1" />
      <ShimmerBlock className="h-8 w-[150px] shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-2)]" />
      <span className="mx-1 h-[22px] w-px shrink-0 bg-[var(--border)]" />
      <ShimmerBlock className="h-8 w-[88px] shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-1)]" />
      <ShimmerBlock className="h-[26px] w-[26px] shrink-0 rounded-full" />
    </header>
  );
}
