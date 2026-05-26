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
    <header className="octo-top-header" aria-hidden>
      <ShimmerBlock className="octo-top-header__logo-skel" />
      <span className="octo-top-header__sep" />
      <nav className="octo-top-header__nav">
        {Array.from({ length: 4 }, (_, i) => (
          <ShimmerBlock key={i} className="octo-top-header__nav-link-skel" />
        ))}
      </nav>
      <div className="octo-top-header__spacer" />
      <ShimmerBlock className="octo-top-header__branch-skel" />
      <span className="octo-top-header__sep" />
      <ShimmerBlock className="octo-top-header__user-skel" />
      <ShimmerBlock className="octo-top-header__avatar-skel" />
    </header>
  );
}
